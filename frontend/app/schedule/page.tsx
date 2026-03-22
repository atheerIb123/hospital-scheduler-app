"use client";
import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import * as api from "@/lib/api";
import { useSchedule } from "@/hooks/useSchedule";
import { useShiftTypes } from "@/hooks/useShiftTypes";
import { useEmployees } from "@/hooks/useEmployees";
import { useDayTypes } from "@/hooks/useDayTypes";
import { useDaySettings } from "@/hooks/useDaySettings";
import { Alert, Button, Input, SearchDropdown, Select } from "@/components/ui";
import { Loader2, Download, Save, AlertTriangle, Calendar, X } from "lucide-react";
import ScheduleTable from "@/components/ScheduleTable";
import CalendarConfigurator from "@/components/CalendarConfigurator";
import type { Assignment } from "@/lib/types";

const MONTH_NAMES = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export default function SchedulePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { schedule, loading, generating, error, generate } = useSchedule(month, year);
  const { shiftTypes } = useShiftTypes();
  const { employees, columnHeaders } = useEmployees();
  const { dayTypes } = useDayTypes();
  const { settings: daySettings, setOverride } = useDaySettings(year, month);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);

  const [localAssignments, setLocalAssignments] = useState<Assignment[]>([]);
  const [changedCells, setChangedCells] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [searchName, setSearchName] = useState("");
  const [filterShift, setFilterShift] = useState("");
  const [filterDay, setFilterDay] = useState(-1);
  const hasAnyFilter = !!searchName.trim() || !!filterShift || filterDay >= 0;
  const DOW_LABELS = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];
  const sortedShiftTypes = [...shiftTypes].sort((a, b) => (a.shift_id ?? 0) - (b.shift_id ?? 0));

  const [maxShifts, setMaxShifts] = useState(0);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("maxShiftsPerMonth");
      if (stored) setMaxShifts(Number(stored));
    } catch { }
  }, []);
  function handleMaxShiftsChange(val: number) {
    const v = Math.max(0, val);
    setMaxShifts(v);
    try { localStorage.setItem("maxShiftsPerMonth", String(v)); } catch { }
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
    <div className="flex flex-col gap-5 fade-in" style={{ height: "calc(100vh - 4rem)" }}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">סידור עבודה</h1>
        <p className="text-slate-500 mt-1 text-sm">
          הסולבר יצור סידור חודשי הוגן תוך שמירה על אילוצי זכאות.
          כל המשמרות מחולקות שווה בין העובדים לפי זכאות.
        </p>
      </div>

      {/* Combined row: buttons on left, filters on right */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        {/* RIGHT in RTL: filters */}
        <div className="flex flex-wrap items-end gap-2">
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
          </Select>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Input
            inputPrefix="מקסימום משמרות לחודש:"
            type="number"
            min={0}
            value={maxShifts === 0 ? "" : maxShifts}
            placeholder="ללא הגבלה"
            onChange={(e) => handleMaxShiftsChange(e.target.value === "" ? 0 : Number(e.target.value))}
            className="w-32 bg-slate-50"
          />
        </div>
        {/* LEFT in RTL: action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={() => generate()}
            disabled={generating}
            style={{ background: generating ? "#94a3b8" : "linear-gradient(135deg,#1d4ed8,#2563eb)" }}>
            {generating ? (
              <>
                <Loader2 className="animate-spin h-4 w-4" />
                <span>מחשב סידור…</span>
              </>
            ) : (
              <span>צור סידור עבודה</span>
            )}
          </Button>
          {schedule?.status === "generated" && (
            <Button variant="secondary" onClick={handleDownloadExcel} icon={<Download className="w-4 h-4" />}>
              הורד Excel
            </Button>
          )}
          {changedCells.size > 0 && (
            <Button
              variant="success"
              onClick={handleSave}
              disabled={saving}
              icon={saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="w-4 h-4" />}
            >
              {saving ? "שומר…" : `שמור שינויים (${changedCells.size})`}
            </Button>
          )}
          {saveSuccess && (
            <span className="text-sm text-emerald-600 font-medium">נשמר בהצלחה</span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert type="error">
          <p className="font-semibold">שגיאה ביצירת הסידור</p>
          <p className="text-sm mt-0.5">{error}</p>
        </Alert>
      )}

      {/* Unfilled shift warnings */}
      {schedule?.warnings && schedule.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">
                {schedule.warnings.length === 1
                  ? "משמרת אחת לא אוישה"
                  : `${schedule.warnings.length} משמרות לא אוישו`}
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                הסולבר לא הצליח למצוא עובד זכאי לאותן משמרות. ניתן לאייש אותן ידנית בטבלה.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {schedule.warnings.map((w, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                    <span className="font-bold">יום {w.day}</span>
                    <span className="text-amber-500">·</span>
                    {w.shift_name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl shimmer" />)}
        </div>
      )}

      {/* Results */}
      {!loading && schedule?.status === "generated" && shiftTypes.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            {/* RIGHT in RTL: search input */}
            <SearchDropdown
              value={searchName}
              onChange={setSearchName}
              options={employees.map(e => e.name)}
              placeholder="חיפוש עובד..."
              className="w-44"
            />
            {/* LEFT in RTL: filter selects + clear */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterDay} onChange={e => setFilterDay(Number(e.target.value))}>
                <option value={-1}>כל הימים</option>
                {DOW_LABELS.map((label, d) => (
                  <option key={d} value={d}>{label}</option>
                ))}
              </Select>
              <Select value={filterShift} onChange={e => setFilterShift(e.target.value)}>
                <option value="">כל המשמרות</option>
                {sortedShiftTypes.map(st => (
                  <option key={st.id} value={st.names[0]}>{st.names[0]}</option>
                ))}
              </Select>
              {hasAnyFilter && (
                <Button
                  variant="ghost"
                  onClick={() => { setSearchName(""); setFilterShift(""); setFilterDay(-1); }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                  icon={<X className="w-3 h-3" />}
                >
                  נקה
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ScheduleTable
              schedule={schedule}
              shiftTypes={shiftTypes}
              assignments={localAssignments}
              onAssignmentChange={handleAssignmentChange}
              changedCells={changedCells}
              employees={employees}
              columnHeaders={columnHeaders}
              maxShifts={maxShifts}
              dayTypes={dayTypes}
              daySettings={daySettings}
              onDayTypeChange={setOverride}
              searchName={searchName}
              filterShift={filterShift}
              filterDay={filterDay}
            />
          </div>
        </div>
      )}

      {!loading && !schedule && !generating && !error && (
        <div className="space-y-6">
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-semibold text-lg">אין סידור ל{MONTH_NAMES[month - 1]} {year} עדיין</p>
            <p className="text-slate-400 text-sm mt-2 mb-6">לחץ &#34;צור סידור עבודה&#34; כדי להתחיל.</p>
            <div className="max-w-md mx-auto p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-sm">
              <p>טיפ: ניתן להגדיר חגים וימים מיוחדים בסידור תחת דף <strong>סוגי משמרות</strong> לפני היצירה.</p>
            </div>
          </div>

          <div className="opacity-60 grayscale pointer-events-none">
            <h2 className="text-xl font-bold text-slate-800 mb-4">תצוגה מקדימה של לוח השנה</h2>
            <CalendarConfigurator dayTypes={dayTypes} />
          </div>
        </div>
      )}
    </div>
  );
}
