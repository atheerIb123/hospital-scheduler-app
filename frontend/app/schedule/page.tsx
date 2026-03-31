"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import * as api from "@/lib/api";
import { useSchedule } from "@/hooks/useSchedule";
import { useShiftTypes } from "@/hooks/useShiftTypes";
import { useEmployees } from "@/hooks/useEmployees";
import { useDayTypes } from "@/hooks/useDayTypes";
import { useDaySettings } from "@/hooks/useDaySettings";
import { Alert, Button, Input, SearchDropdown, DateRangePicker, MultiSelect, TabButton, TabsContainer, Select } from "@/components/ui";
import type { DateRangeValue } from "@/components/ui";
import { Loader2, Download, Save, AlertTriangle, Calendar, X, List, Users, ChevronLeft, ChevronRight } from "lucide-react";
import ScheduleTable from "@/components/ScheduleTable";
import SummaryTable from "@/components/SummaryTable";
import CalendarConfigurator from "@/components/CalendarConfigurator";
import { useConstraints } from "@/hooks/useConstraints";
import { useMode } from "@/components/ModeProvider";
import type { Assignment, WeeklyShiftRow } from "@/lib/types";
import { useWeeklySchedule } from "@/hooks/useWeeklySchedule";
import WeeklyShiftGrid from "@/components/WeeklyShiftGrid";
import EmployeeWeeklyPlan from "@/components/EmployeeWeeklyPlan";

const MONTH_NAMES = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

/** Returns the ISO date string of the Sunday starting the week that contains `d`. */
function toWeekSunday(d: Date): string {
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  return sun.toISOString().split("T")[0];
}

/**
 * Build a rolling window of week-start Sundays:
 * pastWeeks weeks before the current week + current week + futureWeeks weeks ahead.
 */
function buildRollingWeeks(pastWeeks = 2, futureWeeks = 7): string[] {
  const todaySunday = new Date(toWeekSunday(new Date()) + "T12:00:00");
  const weeks: string[] = [];
  for (let i = -pastWeeks; i <= futureWeeks; i++) {
    const d = new Date(todaySunday);
    d.setDate(d.getDate() + i * 7);
    weeks.push(d.toISOString().split("T")[0]);
  }
  return weeks;
}

function weekLabel(iso: string) {
  const start = new Date(iso + "T12:00:00");
  const end = new Date(iso + "T12:00:00");
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

// ─── Nursing Schedule View ────────────────────────────────────────────────────

function buildGridFromAssignments(
  originalGrid: WeeklyShiftRow[],
  assignments: Assignment[],
  weekDays: string[],
): WeeklyShiftRow[] {
  const dayOfMonthToIso: Record<number, string> = {};
  for (const iso of weekDays) {
    dayOfMonthToIso[new Date(iso + "T12:00:00").getDate()] = iso;
  }
  return originalGrid.map(row => ({
    shift_name: row.shift_name,
    hours: row.hours,
    by_day: Object.fromEntries(
      weekDays.map(iso => [
        iso,
        assignments
          .filter(a => dayOfMonthToIso[a.day] === iso && a.shift_name === row.shift_name)
          .map(a => ({ employee_id: a.employee_id, employee_name: a.employee_name })),
      ]),
    ),
  }));
}

function NursingSchedulePage() {
  const { employees, columnHeaders } = useEmployees();
  const rollingWeeks = useMemo(() => buildRollingWeeks(2, 7), []);
  const currentWeekIso = toWeekSunday(new Date());

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) {
      if (e.home_department) set.add(e.home_department);
    }
    return Array.from(set).sort();
  }, [employees]);

  const [selectedDept, setSelectedDept] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekIso);
  const [weeklyTab, setWeeklyTab] = useState<"grid" | "plan">("grid");

  useEffect(() => {
    if (!selectedDept && departments.length > 0) {
      setSelectedDept(departments[0]);
    }
  }, [departments, selectedDept]);

  const { schedule, loading, generating, error, generate } = useWeeklySchedule(
    selectedWeek,
    selectedDept || undefined,
  );

  // ── Local assignment state (ported from doctors mode) ──────────────────────
  const [localAssignments, setLocalAssignments] = useState<Assignment[]>([]);
  const [changedCells, setChangedCells] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (schedule?.assignments) {
      setLocalAssignments(schedule.assignments);
      setChangedCells(new Set());
      setSaveSuccess(false);
    }
  }, [schedule]);

  const weekIdx = rollingWeeks.indexOf(selectedWeek);
  const canPrev = weekIdx > 0;
  const canNext = weekIdx < rollingWeeks.length - 1;

  const weekDays = useMemo(() => {
    if (schedule?.weekly_grid?.[0]) return Object.keys(schedule.weekly_grid[0].by_day).sort();
    if (schedule?.employee_plan?.[0]) return Object.keys(schedule.employee_plan[0].days).sort();
    return [];
  }, [schedule]);

  // shift_name → shift_type_id lookup (for constructing new assignments)
  const shiftNameToId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of schedule?.assignments ?? []) {
      if (a.shift_name && a.shift_type_id) map[a.shift_name] = a.shift_type_id;
    }
    return map;
  }, [schedule]);

  // Derive the display grid from localAssignments so edits are reflected immediately
  const localGrid = useMemo(() => {
    if (!schedule?.weekly_grid || weekDays.length === 0) return schedule?.weekly_grid ?? [];
    return buildGridFromAssignments(schedule.weekly_grid, localAssignments, weekDays);
  }, [schedule?.weekly_grid, localAssignments, weekDays]);

  // Compute per-employee shift counts from local assignments (keyed by employee_id)
  const empShiftCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of localAssignments) {
      if (a.employee_id) counts[a.employee_id] = (counts[a.employee_id] ?? 0) + 1;
    }
    return counts;
  }, [localAssignments]);

  // Detect max-shift violations: employees whose count exceeds their max_shifts_per_week
  const maxShiftsWarningIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ep of schedule?.employee_plan ?? []) {
      const count = empShiftCounts[ep.employee_id] ?? 0;
      if (count > ep.max_shifts_per_week) ids.add(ep.employee_id);
    }
    return ids;
  }, [empShiftCounts, schedule?.employee_plan]);

  // Warnings from the solver (max_shifts_exceeded + unfilled)
  const unfilledWarnings = useMemo(
    () => (schedule?.warnings ?? []).filter(w => w.type !== "max_shifts_exceeded"),
    [schedule?.warnings],
  );
  const solverMaxWarnings = useMemo(
    () => (schedule?.warnings ?? []).filter(w => w.type === "max_shifts_exceeded"),
    [schedule?.warnings],
  );

  // Combine solver max warnings with locally detected violations
  const maxShiftWarningDetails = useMemo(() => {
    const details: { employee_id: string; employee_name: string; assigned: number; max: number }[] = [];
    const seen = new Set<string>();
    for (const w of solverMaxWarnings) {
      if (w.employee_id) {
        seen.add(w.employee_id);
        details.push({
          employee_id: w.employee_id,
          employee_name: w.employee_name ?? "",
          assigned: empShiftCounts[w.employee_id] ?? (w.assigned ?? 0),
          max: w.max ?? 6,
        });
      }
    }
    for (const ep of schedule?.employee_plan ?? []) {
      if (maxShiftsWarningIds.has(ep.employee_id) && !seen.has(ep.employee_id)) {
        details.push({
          employee_id: ep.employee_id,
          employee_name: ep.employee_name,
          assigned: empShiftCounts[ep.employee_id] ?? 0,
          max: ep.max_shifts_per_week,
        });
      }
    }
    return details;
  }, [solverMaxWarnings, maxShiftsWarningIds, empShiftCounts, schedule?.employee_plan]);

  const shiftLeaderIds = useMemo(() => {
    const leaderCol = columnHeaders.indexOf("אחראי משמרת");
    if (leaderCol === -1) return new Set<string>();
    const colKey = `col_${leaderCol + 1}`;
    const ids = new Set<string>();
    for (const e of employees) {
      if (e.attributes?.includes(colKey)) ids.add(e.id);
    }
    return ids;
  }, [employees, columnHeaders]);

  const handleAddEmployee = useCallback((iso: string, shiftName: string, empId: string, empName: string) => {
    const dayOfMonth = new Date(iso + "T12:00:00").getDate();
    setLocalAssignments(prev => [
      ...prev,
      {
        day: dayOfMonth,
        shift_type_id: shiftNameToId[shiftName] ?? "",
        shift_name: shiftName,
        employee_id: empId,
        employee_name: empName,
      },
    ]);
    setChangedCells(prev => new Set(prev).add(`${iso}-${shiftName}`));
    setSaveSuccess(false);
  }, [shiftNameToId]);

  const handleRemoveEmployee = useCallback((iso: string, shiftName: string, empId: string) => {
    const dayOfMonth = new Date(iso + "T12:00:00").getDate();
    setLocalAssignments(prev => {
      const idx = prev.findIndex(
        a => a.day === dayOfMonth && a.shift_name === shiftName && a.employee_id === empId,
      );
      if (idx === -1) return prev;
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
    setChangedCells(prev => new Set(prev).add(`${iso}-${shiftName}`));
    setSaveSuccess(false);
  }, []);

  const handleMoveEmployee = useCallback((
    srcIso: string, srcShift: string, srcEmpId: string, _srcEmpName: string,
    tgtIso: string, tgtShift: string,
  ) => {
    const srcDay = new Date(srcIso + "T12:00:00").getDate();
    const tgtDay = new Date(tgtIso + "T12:00:00").getDate();
    setLocalAssignments(prev => {
      const idx = prev.findIndex(
        a => a.day === srcDay && a.shift_name === srcShift && a.employee_id === srcEmpId,
      );
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        day: tgtDay,
        shift_name: tgtShift,
        shift_type_id: shiftNameToId[tgtShift] ?? updated[idx].shift_type_id,
      };
      return updated;
    });
    setChangedCells(prev => {
      const next = new Set(prev);
      next.add(`${srcIso}-${srcShift}`);
      next.add(`${tgtIso}-${tgtShift}`);
      return next;
    });
    setSaveSuccess(false);
  }, [shiftNameToId]);

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

  return (
    <div className="flex flex-col gap-5 fade-in" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">סידור עבודה שבועי — סיעוד</h1>
        <p className="text-slate-500 mt-1 text-sm">
          יצירת סידור שבועי לפי הרכב משמרות ואילוצי עובדים.
        </p>
      </div>

      {/* Controls card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        {/* Row 1: department + generate + save */}
        <div className="flex items-center gap-3 flex-wrap">
          {departments.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">מחלקה:</span>
              <Select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="min-w-[160px]"
              >
                <option value="">כל המחלקות</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            </div>
          )}

          <div className="flex-1" />

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

          <Button
            variant="primary"
            onClick={() => generate()}
            disabled={generating || !selectedWeek}
            icon={generating ? <Loader2 className="animate-spin h-4 w-4" /> : undefined}
          >
            {generating ? "מחשב..." : "צור סידור שבועי"}
          </Button>
        </div>

        {/* Row 2: week selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">שבוע:</span>

          <button
            type="button"
            onClick={() => canPrev && setSelectedWeek(rollingWeeks[weekIdx - 1])}
            disabled={!canPrev}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {rollingWeeks.map(iso => {
              const isCurrent = iso === currentWeekIso;
              const isSelected = iso === selectedWeek;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedWeek(iso)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : isCurrent
                      ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                  }`}
                >
                  {weekLabel(iso)}
                  {isCurrent && !isSelected && (
                    <span className="mr-1 text-[10px] font-normal opacity-70">עכשיו</span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => canNext && setSelectedWeek(rollingWeeks[weekIdx + 1])}
            disabled={!canNext}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert type="error">
          <p className="font-semibold">שגיאה ביצירת הסידור</p>
          <p className="text-sm mt-0.5">{error}</p>
        </Alert>
      )}

      {/* Unfilled-shift warnings */}
      {unfilledWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">
                {unfilledWarnings.length === 1 ? "משמרת אחת לא אוישה" : `${unfilledWarnings.length} משמרות לא אוישו`}
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                הסולבר לא הצליח למצוא עובד זכאי לאותן משמרות. ניתן לאייש אותן ידנית בלוח.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {unfilledWarnings.map((w, i) => (
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

      {/* Max-shift-exceeded warnings */}
      {maxShiftWarningDetails.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-800">
                {maxShiftWarningDetails.length === 1
                  ? "עובד אחד חורג ממכסת המשמרות השבועית"
                  : `${maxShiftWarningDetails.length} עובדים חורגים ממכסת המשמרות השבועית`}
              </p>
              <p className="text-sm text-red-700 mt-0.5">
                עובדים אלו שובצו ליותר משמרות מהמותר כדי לאייש את כל המשבצות. ניתן להתאים ידנית בלוח.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {maxShiftWarningDetails.map(d => (
                  <span key={d.employee_id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                    <span className="font-bold">{d.employee_name}</span>
                    <span className="text-red-500">·</span>
                    {d.assigned}/{d.max} משמרות
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="h-24 rounded-2xl shimmer" />}

      {/* Results */}
      {!loading && schedule?.status === "generated" && (
        <div className="space-y-3">
          <TabsContainer>
            <TabButton active={weeklyTab === "grid"} onClick={() => setWeeklyTab("grid")} className="px-4 py-2">
              <span className="inline-flex items-center gap-1.5"><List className="w-3.5 h-3.5" />לוח משמרות</span>
            </TabButton>
            <TabButton active={weeklyTab === "plan"} onClick={() => setWeeklyTab("plan")} className="px-4 py-2">
              <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />תכנון עובדים</span>
            </TabButton>
          </TabsContainer>

          {weeklyTab === "grid" && localGrid.length > 0 && (
            <WeeklyShiftGrid
              grid={localGrid}
              weekDays={weekDays}
              editable
              employees={schedule.employee_plan}
              changedCells={changedCells}
              maxShiftsWarningIds={maxShiftsWarningIds}
              empShiftCounts={empShiftCounts}
              onAddEmployee={handleAddEmployee}
              onRemoveEmployee={handleRemoveEmployee}
              onMoveEmployee={handleMoveEmployee}
              shiftLeaderIds={shiftLeaderIds}
            />
          )}
          {weeklyTab === "plan" && schedule.employee_plan && (
            <EmployeeWeeklyPlan plan={schedule.employee_plan} weekDays={weekDays} />
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !schedule && !generating && !error && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-600 font-semibold text-lg">אין סידור לשבוע זה עדיין</p>
          <p className="text-slate-400 text-sm mt-2">
            {selectedDept ? `מחלקה: ${selectedDept} · ` : ""}{weekLabel(selectedWeek)}
          </p>
          <p className="text-slate-400 text-sm mt-1">לחץ &#34;צור סידור שבועי&#34; כדי להתחיל.</p>
        </div>
      )}
    </div>
  );
}

// ─── Doctors / Default Schedule View ─────────────────────────────────────────

export default function SchedulePage() {
  const { mode } = useMode();
  const isNursing = mode.startsWith("nursing");

  if (isNursing) return <NursingSchedulePage />;

  return <DoctorsSchedulePage />;
}

function DoctorsSchedulePage() {
  const now = new Date();
  const [dateRange, setDateRange] = useState<DateRangeValue | null>(null);
  const month = dateRange ? new Date(dateRange.start + "T00:00:00").getMonth() + 1 : now.getMonth() + 1;
  const year  = dateRange ? new Date(dateRange.start + "T00:00:00").getFullYear() : now.getFullYear();

  const { schedule, loading, generating, error, generate } = useSchedule(month, year);
  const { shiftTypes } = useShiftTypes();
  const { employees, columnHeaders } = useEmployees();
  const { dayTypes } = useDayTypes();
  const { settings: daySettings, setOverride } = useDaySettings(year, month);
  const { constraints } = useConstraints(month, year);

  const [scheduleView, setScheduleView] = useState<"schedule" | "summary">("schedule");

  const [localAssignments, setLocalAssignments] = useState<Assignment[]>([]);
  const [changedCells, setChangedCells] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [searchName, setSearchName] = useState("");
  const [filterShifts, setFilterShifts] = useState<string[]>([]);
  const [filterDays, setFilterDays] = useState<number[]>([]);
  const hasAnyFilter = !!searchName.trim() || filterShifts.length > 0 || filterDays.length > 0;
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
      <div>
        <h1 className="text-3xl font-bold text-slate-800">סידור עבודה</h1>
        <p className="text-slate-500 mt-1 text-sm">
          הסולבר יצור סידור חודשי הוגן תוך שמירה על אילוצי זכאות.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <DateRangePicker
            availableTypes={["month"]}
            defaultType="month"
            onChange={setDateRange}
          />
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

      {error && (
        <Alert type="error">
          <p className="font-semibold">שגיאה ביצירת הסידור</p>
          <p className="text-sm mt-0.5">{error}</p>
        </Alert>
      )}

      {schedule?.warnings && schedule.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">
                {schedule.warnings.length === 1 ? "משמרת אחת לא אוישה" : `${schedule.warnings.length} משמרות לא אוישו`}
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

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl shimmer" />)}
        </div>
      )}

      {!loading && schedule?.status === "generated" && shiftTypes.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col fade-in">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <TabsContainer>
              <TabButton active={scheduleView === "schedule"} onClick={() => setScheduleView("schedule")}>
                <span className="inline-flex items-center gap-1.5"><List className="w-3.5 h-3.5" />לוח משמרות</span>
              </TabButton>
              <TabButton active={scheduleView === "summary"} onClick={() => setScheduleView("summary")}>
                <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />סיכום עובדים</span>
              </TabButton>
            </TabsContainer>

            {scheduleView === "schedule" && (
              <div className="flex flex-wrap items-center gap-2">
                <SearchDropdown
                  value={searchName}
                  onChange={setSearchName}
                  options={employees.map(e => e.name)}
                  placeholder="חיפוש עובד..."
                  className="w-44"
                />
                <MultiSelect
                  value={filterDays.map(String)}
                  onChange={vals => setFilterDays(vals.map(Number))}
                  placeholder="כל הימים"
                  options={DOW_LABELS.map((label, d) => ({ value: String(d), label }))}
                />
                <MultiSelect
                  value={filterShifts}
                  onChange={setFilterShifts}
                  placeholder="כל המשמרות"
                  options={sortedShiftTypes.map(st => ({ value: st.names[0], label: st.names[0] }))}
                />
                {hasAnyFilter && (
                  <Button
                    variant="ghost"
                    onClick={() => { setSearchName(""); setFilterShifts([]); setFilterDays([]); }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                    icon={<X className="w-3 h-3" />}
                  >
                    נקה
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0">
            {scheduleView === "schedule" && (
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
                filterShifts={filterShifts}
                filterDays={filterDays}
              />
            )}
            {scheduleView === "summary" && (
              <SummaryTable
                schedule={schedule}
                shiftTypes={shiftTypes}
                assignments={localAssignments}
                employees={employees}
                constraints={constraints}
              />
            )}
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
