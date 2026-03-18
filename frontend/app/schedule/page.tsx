"use client";
import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import * as api from "@/lib/api";
import { useSchedule } from "@/hooks/useSchedule";
import { useShiftTypes } from "@/hooks/useShiftTypes";
import { useEmployees } from "@/hooks/useEmployees";
import ScheduleTable from "@/components/ScheduleTable";
import SummaryTable from "@/components/SummaryTable";
import type { Assignment } from "@/lib/types";

const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

export default function SchedulePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());

  const { schedule, loading, generating, error, generate } = useSchedule(month, year);
  const { shiftTypes } = useShiftTypes();
  const { employees, columnHeaders } = useEmployees();

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);

  const [localAssignments, setLocalAssignments] = useState<Assignment[]>([]);
  const [changedCells, setChangedCells] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [maxShifts, setMaxShifts] = useState(0);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("maxShiftsPerMonth");
      if (stored) setMaxShifts(Number(stored));
    } catch {}
  }, []);
  function handleMaxShiftsChange(val: number) {
    const v = Math.max(0, val);
    setMaxShifts(v);
    try { localStorage.setItem("maxShiftsPerMonth", String(v)); } catch {}
  }

  useEffect(() => {
    if (schedule?.assignments) {
      setLocalAssignments(schedule.assignments);
      setChangedCells(new Set());
    }
  }, [schedule]);

  const handleAssignmentChange = useCallback((day: number, shiftName: string, newEmpName: string) => {
    setLocalAssignments(prev => prev.map(a =>
      a.day === day && a.shift_name === shiftName
        ? { ...a, employee_name: newEmpName }
        : a
    ));
    setChangedCells(prev => new Set(prev).add(`${day}-${shiftName}`));
    setSaveSuccess(false);
  }, []);

  const handleSave = async () => {
    if (!schedule) return;
    setSaving(true);
    try {
      await api.updateAssignments(schedule.id, localAssignments);
      setChangedCells(new Set());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!schedule || !shiftTypes) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Schedule
    const activeShifts = [...shiftTypes].sort((a, b) => (a.shift_id ?? 0) - (b.shift_id ?? 0));
    const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();
    const lookup: Record<number, Record<string, string>> = {};
    for (const a of localAssignments) {
      if (!lookup[a.day]) lookup[a.day] = {};
      lookup[a.day][a.shift_name] = a.employee_name;
    }
    const schedHeaders = ["יום", ...activeShifts.map(st => st.names.join(", "))];
    const schedRows = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dayOfWeek = new Date(schedule.year, schedule.month - 1, day).getDay();
      const dayLabel = `${day}${dayOfWeek === 5 ? " (ו)" : dayOfWeek === 6 ? " (ש)" : ""}`;
      return [dayLabel, ...activeShifts.map(st => lookup[day]?.[st.names[0]] ?? "")];
    });
    const ws1 = XLSX.utils.aoa_to_sheet([schedHeaders, ...schedRows]);
    ws1["!cols"] = schedHeaders.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws1, "לוח משמרות");

    // Sheet 2: Summary (computed from localAssignments)
    const empMap: Record<string, Record<string, number>> = {};
    for (const a of localAssignments) {
      if (!empMap[a.employee_name]) empMap[a.employee_name] = {};
      empMap[a.employee_name][a.shift_name] = (empMap[a.employee_name][a.shift_name] ?? 0) + 1;
    }
    const summaryHeaders = ["עובד", ...activeShifts.map(st => st.names.join(", ")), "סה״כ"];
    const summaryRows = Object.entries(empMap).map(([emp, counts]) => {
      const row = activeShifts.map(st => counts[st.names[0]] ?? 0);
      return [emp, ...row, row.reduce((s, v) => s + v, 0)];
    });
    const ws2 = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
    ws2["!cols"] = summaryHeaders.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws2, "סיכום");

    const monthName = MONTH_NAMES[schedule.month - 1];
    XLSX.writeFile(wb, `סידור_${monthName}_${schedule.year}.xlsx`);
  };

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">סידור עבודה</h1>
        <p className="text-slate-500 mt-1 text-sm">
          הסולבר יצור סידור חודשי הוגן תוך שמירה על אילוצי זכאות.
          משמרות <span className="text-amber-600 font-semibold">רצויות ★</span> מקבלות משקל כפול בפיזור.
        </p>
      </div>

      {/* Controls card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">חודש</label>
            <select
              className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
              value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">שנה</label>
            <select
              className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
              value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">מקסימום משמרות לחודש</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={maxShifts === 0 ? "" : maxShifts}
                placeholder="ללא הגבלה"
                onChange={(e) => handleMaxShiftsChange(e.target.value === "" ? 0 : Number(e.target.value))}
                className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all w-32"
              />
              {maxShifts > 0 && (
                <span className="text-xs text-slate-400">{maxShifts} משמרות</span>
              )}
            </div>
          </div>
          <button
            onClick={() => generate()}
            disabled={generating}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-95"
            style={{ background: generating ? "#94a3b8" : "linear-gradient(135deg,#1d4ed8,#2563eb)" }}>
            {generating ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <span>מחשב סידור…</span>
              </>
            ) : (
                <span>צור סידור עבודה</span>
            )}
          </button>

          {changedCells.size > 0 && (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md active:scale-95 border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
              {saving ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                </svg>
              )}
              <span>{saving ? "שומר…" : `שמור שינויים (${changedCells.size})`}</span>
            </button>
          )}
          {saveSuccess && (
            <span className="text-sm text-emerald-600 font-medium">נשמר בהצלחה</span>
          )}
          {schedule?.status === "generated" && (
            <button onClick={handleDownloadExcel}
              className="mr-auto flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-600">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <span>הורד Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700">
          <span className="text-xl mt-0.5 text-red-500 font-bold">!</span>
          <div>
            <p className="font-semibold">שגיאה ביצירת הסידור</p>
            <p className="text-sm mt-0.5 text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl shimmer" />)}
        </div>
      )}

      {/* Results */}
      {!loading && schedule?.status === "generated" && shiftTypes.length > 0 && (
        <div className="space-y-8 fade-in">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-slate-800">לוח משמרות</h2>
              <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-medium">
                {MONTH_NAMES[schedule.month-1]} {schedule.year}
              </span>
            </div>
            <ScheduleTable
              schedule={schedule}
              shiftTypes={shiftTypes}
              assignments={localAssignments}
              onAssignmentChange={handleAssignmentChange}
              changedCells={changedCells}
              employees={employees}
              columnHeaders={columnHeaders}
              maxShifts={maxShifts}
            />
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-slate-800">סיכום לעובד</h2>
              <span className="text-xs bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full font-medium">
                גבוה / נמוך
              </span>
            </div>
            <SummaryTable schedule={schedule} shiftTypes={shiftTypes} assignments={localAssignments} />
          </div>
        </div>
      )}

      {!loading && !schedule && !generating && !error && (
        <div className="text-center py-24 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <p className="text-slate-600 font-semibold text-lg">אין סידור עדיין</p>
          <p className="text-slate-400 text-sm mt-2">הגדר עובדים וסוגי משמרות, ולחץ &#34;צור סידור עבודה&#34;</p>
        </div>
      )}
    </div>
  );
}
