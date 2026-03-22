"use client";
import { useState, useEffect, useMemo } from "react";
import { getStats } from "@/lib/api";
import type { StatsData } from "@/lib/api";

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
  const [tab, setTab] = useState<"general" | "byFilter" | "byEmployee">("general");
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
  ] as const;

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
          {/* ── Tab 1: General — full breakdown table ──────────────────────── */}
          {tab === "general" && (() => {
            if (generalRows.length === 0) return <EmptyState msg="אין נתונים בטווח הזמן הנבחר" />;

            const shiftNames = data.shift_names;
            // per-employee per-shift counts
            const empMap: Record<string, Record<string, number>> = {};
            data.employees.forEach(e => { empMap[e] = {}; });
            data.assignments.forEach(a => {
              if (!empMap[a.employee_name]) empMap[a.employee_name] = {};
              empMap[a.employee_name][a.shift_name] = (empMap[a.employee_name][a.shift_name] ?? 0) + 1;
            });
            // filtered + sorted by total desc
            const rows = data.employees
              .filter(e => !search || e.includes(search))
              .map(e => ({ name: e, counts: empMap[e] ?? {}, total: Object.values(empMap[e] ?? {}).reduce((s, v) => s + v, 0) }))
              .sort((a, b) => b.total - a.total);

            // col stats for high/low highlighting
            const colStats: Record<string, { min: number; max: number }> = {};
            shiftNames.forEach(s => {
              const vals = rows.map(r => r.counts[s] ?? 0);
              colStats[s] = { min: Math.min(...vals), max: Math.max(...vals) };
            });
            const totals = rows.map(r => r.total);
            const totalStats = { min: Math.min(...totals), max: Math.max(...totals) };
            const maxTotal = Math.max(...totals, 1);

            const SHIFT_COLORS = [
              "bg-violet-100 text-violet-700","bg-sky-100 text-sky-700","bg-emerald-100 text-emerald-700",
              "bg-rose-100 text-rose-700","bg-amber-100 text-amber-700","bg-cyan-100 text-cyan-700",
              "bg-pink-100 text-pink-700","bg-indigo-100 text-indigo-700","bg-teal-100 text-teal-700",
              "bg-orange-100 text-orange-700","bg-lime-100 text-lime-700","bg-fuchsia-100 text-fuchsia-700",
              "bg-red-100 text-red-700","bg-blue-100 text-blue-700",
            ];

            return (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-800">סיכום משמרות לעובד</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{data.assignments.length} משמרות בטווח הנבחר</p>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full font-medium">גבוה / נמוך</span>
                </div>
                <div className="overflow-x-auto" style={{ maxHeight: "560px", overflowY: "auto" }}>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-5 py-3 text-right font-semibold text-slate-600 whitespace-nowrap sticky top-0 bg-slate-50 z-10">#</th>
                        <th className="px-5 py-3 text-right font-semibold text-slate-600 whitespace-nowrap sticky top-0 bg-slate-50 z-10">עובד</th>
                        {shiftNames.map((s, i) => (
                          <th key={s} className="px-3 py-3 text-center font-semibold whitespace-nowrap sticky top-0 bg-slate-50 z-10">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${SHIFT_COLORS[i % SHIFT_COLORS.length]}`}>{s}</span>
                          </th>
                        ))}
                        <th className="px-5 py-3 text-center font-bold text-slate-700 whitespace-nowrap sticky top-0 bg-slate-50 z-10">סה״כ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={row.name} className={`border-b border-slate-50 hover:bg-blue-50/30 ${idx % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                          <td className="px-5 py-3 text-slate-400 text-xs font-medium">{idx + 1}</td>
                          <td className="px-5 py-3 font-semibold text-slate-800 whitespace-nowrap">{row.name}</td>
                          {shiftNames.map(s => {
                            const val = row.counts[s] ?? 0;
                            const { min, max } = colStats[s];
                            const isHigh = val === max && min !== max;
                            const isLow  = val === min && min !== max;
                            return (
                              <td key={s} className="px-3 py-3 text-center">
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                  isHigh ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300" :
                                  isLow  ? "bg-red-100 text-red-600 ring-2 ring-red-200" :
                                  "text-slate-600"
                                }`}>{val}</span>
                              </td>
                            );
                          })}
                          <td className="px-5 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-sm font-bold ${
                                row.total === totalStats.max && totalStats.min !== totalStats.max ? "text-emerald-600" :
                                row.total === totalStats.min && totalStats.min !== totalStats.max ? "text-red-500" :
                                "text-slate-700"
                              }`}>{row.total}</span>
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(row.total / maxTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

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

    </div>
  );
}
