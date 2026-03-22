"use client";
import { useState, useEffect, useMemo } from "react";
import { getStats, getScheduleByMonth } from "@/lib/api";
import type { StatsData } from "@/lib/api";
import { useShiftTypes } from "@/hooks/useShiftTypes";
import SummaryTable from "@/components/SummaryTable";

// ── constants ────────────────────────────────────────────────────────────────

const RANGES = [
  { label: "שבוע",    days: 7 },
  { label: "חודש",    days: 30 },
  { label: "שנה",     days: 365 },
  { label: "5 שנים",  days: 5 * 365 },
] as const;

const DOW_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DOW_COLORS = [
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-violet-100 text-violet-700 border-violet-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-sky-100 text-sky-700 border-sky-200",
  "bg-orange-100 text-orange-700 border-orange-200",
  "bg-rose-100 text-rose-700 border-rose-200",
];
const DOW_BAR_COLORS = [
  "bg-blue-400", "bg-indigo-400", "bg-violet-400", "bg-purple-400",
  "bg-sky-400", "bg-orange-400", "bg-rose-400",
];

// ── helpers ──────────────────────────────────────────────────────────────────

function getRangeDates(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

// ── sub-components ───────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const colors =
    rank === 1 ? "bg-amber-400 text-white" :
    rank === 2 ? "bg-slate-400 text-white" :
    rank === 3 ? "bg-orange-400 text-white" :
    "bg-slate-100 text-slate-500";
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${colors}`}>
      {rank}
    </span>
  );
}

function BarRow({
  name,
  count,
  max,
  rank,
  color = "bg-blue-400",
}: {
  name: string;
  count: number;
  max: number;
  rank: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.max(count > 0 ? 3 : 0, Math.round((count / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
      <RankBadge rank={rank} />
      <span className="w-32 shrink-0 text-sm font-medium text-slate-700 truncate text-right" dir="rtl">{name}</span>
      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-left text-sm font-bold text-slate-600 shrink-0">{count}</span>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="text-center py-12 text-slate-400 text-sm">{msg}</div>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [rangeIdx, setRangeIdx] = useState(1);
  const [tab, setTab] = useState<"general" | "byFilter" | "byEmployee" | "monthly">("general");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // tab 2 state
  const [filterMode, setFilterMode] = useState<"shift" | "day">("shift");
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // tab 3 state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  // global employee search (applies to all tabs)
  const [search, setSearch] = useState("");

  // monthly summary tab state
  const now = new Date();
  const [sumMonth, setSumMonth] = useState(now.getMonth() + 1);
  const [sumYear, setSumYear] = useState(now.getFullYear());
  const [sumSchedule, setSumSchedule] = useState<import("@/lib/types").Schedule | null>(null);
  const [sumLoading, setSumLoading] = useState(false);
  const { shiftTypes } = useShiftTypes();

  useEffect(() => {
    if (tab !== "monthly") return;
    setSumLoading(true);
    getScheduleByMonth(sumMonth, sumYear)
      .then(setSumSchedule)
      .catch(() => setSumSchedule(null))
      .finally(() => setSumLoading(false));
  }, [tab, sumMonth, sumYear]);

  // fetch on range change
  useEffect(() => {
    const { startDate, endDate } = getRangeDates(RANGES[rangeIdx].days);
    setLoading(true);
    setError(null);
    getStats(startDate, endDate)
      .then((d) => { setData(d); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [rangeIdx]);

  // ── aggregations ──────────────────────────────────────────────────────────

  const generalRows = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    data.employees.forEach((e) => { counts[e] = 0; });
    data.assignments.forEach((a) => { counts[a.employee_name] = (counts[a.employee_name] ?? 0) + 1; });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .filter(({ name }) => !search || name.includes(search))
      .sort((a, b) => b.count - a.count);
  }, [data, search]);

  const byShiftRows = useMemo(() => {
    if (!data || !selectedShift) return [];
    const counts: Record<string, number> = {};
    data.employees.forEach((e) => { counts[e] = 0; });
    data.assignments
      .filter((a) => a.shift_name === selectedShift)
      .forEach((a) => { counts[a.employee_name] = (counts[a.employee_name] ?? 0) + 1; });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .filter(({ name }) => !search || name.includes(search))
      .sort((a, b) => b.count - a.count);
  }, [data, selectedShift, search]);

  const byDayRows = useMemo(() => {
    if (!data || selectedDay === null) return [];
    const counts: Record<string, number> = {};
    data.employees.forEach((e) => { counts[e] = 0; });
    data.assignments
      .filter((a) => a.day_of_week === selectedDay)
      .forEach((a) => { counts[a.employee_name] = (counts[a.employee_name] ?? 0) + 1; });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .filter(({ name }) => !search || name.includes(search))
      .sort((a, b) => b.count - a.count);
  }, [data, selectedDay, search]);

  const empShiftRows = useMemo(() => {
    if (!data || !selectedEmployee) return [];
    const counts: Record<string, number> = {};
    data.shift_names.forEach((s) => { counts[s] = 0; });
    data.assignments
      .filter((a) => a.employee_name === selectedEmployee)
      .forEach((a) => { counts[a.shift_name] = (counts[a.shift_name] ?? 0) + 1; });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [data, selectedEmployee]);

  const empDayRows = useMemo(() => {
    if (!data || !selectedEmployee) return [];
    const counts: Record<number, number> = {};
    DOW_LABELS.forEach((_, i) => { counts[i] = 0; });
    data.assignments
      .filter((a) => a.employee_name === selectedEmployee)
      .forEach((a) => { counts[a.day_of_week] = (counts[a.day_of_week] ?? 0) + 1; });
    return DOW_LABELS.map((label, i) => ({ label, count: counts[i], dow: i }));
  }, [data, selectedEmployee]);

  const filteredEmployees = useMemo(
    () => (data?.employees ?? []).filter((e) => !search || e.includes(search)),
    [data, search]
  );

  // ── render ────────────────────────────────────────────────────────────────

  const tabs = [
    { id: "general",     label: "כללי" },
    { id: "byFilter",    label: "לפי משמרת / יום" },
    { id: "byEmployee",  label: "לפי עובד" },
    { id: "monthly",     label: "סיכום חודשי" },
  ] as const;

  const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">סטטיסטיקות</h1>
          <p className="text-slate-500 mt-1 text-sm">נתוני משמרות לפי טווח זמן</p>
        </div>

        {/* Range selector */}
        <div className="flex gap-1.5">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRangeIdx(i)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                rangeIdx === i
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Tabs row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
        </div>

        {/* Global employee search */}
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            dir="rtl"
            placeholder="חיפוש עובד..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 pl-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 w-48 bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl shimmer" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{error}</div>
      ) : !data ? null : (

        <>
          {/* ── Tab 1: General ─────────────────────────────────────────────── */}
          {tab === "general" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">סה"כ משמרות לכל עובד</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {data.assignments.length} משמרות בטווח הנבחר
                </p>
              </div>
              <div className="p-6">
                {generalRows.length === 0 ? (
                  <EmptyState msg="אין נתונים בטווח הזמן הנבחר" />
                ) : (() => {
                  const max = generalRows[0]?.count ?? 0;
                  return generalRows.map((row, i) => (
                    <BarRow key={row.name} name={row.name} count={row.count} max={max} rank={i + 1} color="bg-blue-400" />
                  ));
                })()}
              </div>
            </div>
          )}

          {/* ── Tab 2: By shift / day ──────────────────────────────────────── */}
          {tab === "byFilter" && (
            <div className="space-y-4">
              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFilterMode("shift")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    filterMode === "shift"
                      ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  לפי משמרת
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("day")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    filterMode === "day"
                      ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  לפי יום
                </button>
              </div>

              {/* Shift selector */}
              {filterMode === "shift" && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-800">בחר משמרת</h2>
                  </div>
                  <div className="p-4 flex flex-wrap gap-2">
                    {data.shift_names.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">אין משמרות בטווח הנבחר</p>
                    ) : data.shift_names.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedShift(s === selectedShift ? null : s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          selectedShift === s
                            ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {selectedShift && (
                    <>
                      <div className="px-6 py-3 border-t border-slate-100 bg-violet-50">
                        <p className="text-sm font-semibold text-violet-700">
                          משמרת: {selectedShift} — {byShiftRows.filter(r => r.count > 0).length} עובדים עשו אותה
                        </p>
                      </div>
                      <div className="p-6">
                        {(() => {
                          const max = byShiftRows[0]?.count ?? 0;
                          return byShiftRows.map((row, i) => (
                            <BarRow key={row.name} name={row.name} count={row.count} max={max || 1} rank={i + 1} color="bg-violet-400" />
                          ));
                        })()}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Day selector */}
              {filterMode === "day" && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-800">בחר יום</h2>
                  </div>
                  <div className="p-4 flex flex-wrap gap-2">
                    {DOW_LABELS.map((label, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedDay(i === selectedDay ? null : i)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                          selectedDay === i
                            ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                            : `${DOW_COLORS[i]} hover:shadow-sm`
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {selectedDay !== null && (
                    <>
                      <div className="px-6 py-3 border-t border-slate-100 bg-violet-50">
                        <p className="text-sm font-semibold text-violet-700">
                          יום {DOW_LABELS[selectedDay]} — {byDayRows.filter(r => r.count > 0).length} עובדים
                        </p>
                      </div>
                      <div className="p-6">
                        {(() => {
                          const max = byDayRows[0]?.count ?? 0;
                          return byDayRows.map((row, i) => (
                            <BarRow key={row.name} name={row.name} count={row.count} max={max || 1} rank={i + 1} color="bg-violet-400" />
                          ));
                        })()}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Tab 3: By employee ─────────────────────────────────────────── */}
          {tab === "byEmployee" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Employee list */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden lg:col-span-1 h-fit">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-800">בחר עובד</h2>
                  {search && (
                    <p className="text-xs text-blue-600 mt-1">מסונן: "{search}"</p>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {filteredEmployees.map((emp) => {
                    const total = data.assignments.filter((a) => a.employee_name === emp).length;
                    return (
                      <button
                        key={emp}
                        type="button"
                        onClick={() => setSelectedEmployee(emp === selectedEmployee ? null : emp)}
                        className={`w-full flex items-center justify-between px-5 py-3 text-sm border-b border-slate-50 transition-all ${
                          selectedEmployee === emp
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                        dir="rtl"
                      >
                        <span>{emp}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          selectedEmployee === emp ? "bg-blue-200 text-blue-700" : "bg-slate-100 text-slate-500"
                        }`}>
                          {total}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Employee detail */}
              <div className="lg:col-span-2 space-y-4">
                {!selectedEmployee ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center text-slate-400 text-sm">
                    בחר עובד מהרשימה לצפייה בפירוט
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl px-6 py-4">
                      <h2 className="text-lg font-bold text-blue-800">{selectedEmployee}</h2>
                      <p className="text-sm text-blue-600 mt-0.5">
                        סה"כ {data.assignments.filter(a => a.employee_name === selectedEmployee).length} משמרות בטווח הנבחר
                      </p>
                    </div>

                    {/* Per shift */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100">
                        <h3 className="font-semibold text-slate-800">פירוט לפי משמרת</h3>
                      </div>
                      <div className="p-6">
                        {empShiftRows.length === 0 ? (
                          <EmptyState msg="אין נתונים" />
                        ) : (() => {
                          const max = empShiftRows[0]?.count ?? 0;
                          return empShiftRows.map((row, i) => (
                            <BarRow key={row.name} name={row.name} count={row.count} max={max || 1} rank={i + 1} color="bg-emerald-400" />
                          ));
                        })()}
                      </div>
                    </div>

                    {/* Per day of week */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100">
                        <h3 className="font-semibold text-slate-800">פירוט לפי יום</h3>
                      </div>
                      <div className="p-6">
                        {(() => {
                          const max = Math.max(...empDayRows.map(r => r.count));
                          return empDayRows.map((row, i) => (
                            <BarRow key={row.dow} name={row.label} count={row.count} max={max || 1} rank={i + 1} color={DOW_BAR_COLORS[row.dow]} />
                          ));
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab 4: Monthly summary ───────────────────────────────────────── */}
      {tab === "monthly" && (
        <div className="space-y-4">
          {/* Month / year selector */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">חודש</label>
              <select
                value={sumMonth}
                onChange={(e) => setSumMonth(Number(e.target.value))}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">שנה</label>
              <select
                value={sumYear}
                onChange={(e) => setSumYear(Number(e.target.value))}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {sumLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-xl shimmer" />)}</div>
          ) : !sumSchedule || sumSchedule.status !== "generated" ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm text-slate-400">
              <p className="font-medium">אין סידור ל{MONTH_NAMES[sumMonth - 1]} {sumYear}</p>
            </div>
          ) : (
            <SummaryTable
              schedule={sumSchedule}
              shiftTypes={shiftTypes}
              assignments={sumSchedule.assignments ?? []}
            />
          )}
        </div>
      )}
    </div>
  );
}
