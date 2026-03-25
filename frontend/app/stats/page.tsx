"use client";
import { useState, useEffect, useMemo } from "react";
import { getStats } from "@/lib/api";
import type { StatsData } from "@/lib/api";
import { Alert, TabButton, TabsContainer, SearchDropdown, Badge, Select, DateRangePicker } from "@/components/ui";
import type { DateRangeValue } from "@/components/ui";
import { SHIFT_COLORS } from "@/lib/colors";

// ── constants ────────────────────────────────────────────────────────────────

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
  const [dateRange, setDateRange] = useState<DateRangeValue | null>(null);

  const [tab, setTab] = useState<"general" | "pointsSummary" | "byShift" | "byDay" | "byEmployee">("general");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // tab 2/3 state
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // tab 3 state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  // global employee search (applies to all tabs)
  const [search, setSearch] = useState("");

  const activeStart = dateRange?.start ?? "";
  const activeEnd   = dateRange?.end   ?? "";

  // fetch on range change
  useEffect(() => {
    if (!activeStart || !activeEnd) return;
    setLoading(true);
    setError(null);
    getStats(activeStart, activeEnd)
      .then((d) => { setData(d); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [activeStart, activeEnd]);

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

  // always resolve to a valid employee when on byEmployee tab
  const effectiveEmployee = tab === "byEmployee"
    ? (selectedEmployee ?? data?.employees[0] ?? null)
    : selectedEmployee;

  const empShiftRows = useMemo(() => {
    if (!data || !effectiveEmployee) return [];
    const counts: Record<string, number> = {};
    data.shift_names.forEach((s) => { counts[s] = 0; });
    data.assignments
      .filter((a) => a.employee_name === effectiveEmployee)
      .forEach((a) => { counts[a.shift_name] = (counts[a.shift_name] ?? 0) + 1; });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [data, effectiveEmployee]);

  const empDayRows = useMemo(() => {
    if (!data || !effectiveEmployee) return [];
    const counts: Record<number, number> = {};
    DOW_LABELS.forEach((_, i) => { counts[i] = 0; });
    data.assignments
      .filter((a) => a.employee_name === effectiveEmployee)
      .forEach((a) => { counts[a.day_of_week] = (counts[a.day_of_week] ?? 0) + 1; });
    return DOW_LABELS.map((label, i) => ({ label, count: counts[i], dow: i }));
  }, [data, effectiveEmployee]);

  const empAssignments = useMemo(() => {
    if (!data || !effectiveEmployee) return [];
    return data.assignments
      .filter((a) => a.employee_name === effectiveEmployee)
      .sort((a, b) => {
        const da = a.date ? a.date : "";
        const db = b.date ? b.date : "";
        return da.localeCompare(db);
      });
  }, [data, effectiveEmployee]);

  const filteredEmployees = useMemo(
    () => (data?.employees ?? []).filter((e) => !search || e.includes(search)),
    [data, search]
  );

  const shiftSummary = useMemo(() => {
    if (!data) return null;
    const shiftNames = data.shift_names;
    const empMap: Record<string, Record<string, number>> = {};
    data.employees.forEach(e => { empMap[e] = {}; });
    data.assignments.forEach(a => {
      if (!empMap[a.employee_name]) empMap[a.employee_name] = {};
      empMap[a.employee_name][a.shift_name] = (empMap[a.employee_name][a.shift_name] ?? 0) + 1;
    });
    const rows = data.employees
      .filter(e => !search || e.includes(search))
      .map(e => ({ name: e, counts: empMap[e] ?? {}, total: Object.values(empMap[e] ?? {}).reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.total - a.total);
    const colStats: Record<string, { min: number; max: number }> = {};
    shiftNames.forEach(s => {
      const vals = rows.map(r => r.counts[s] ?? 0);
      colStats[s] = { min: Math.min(...vals), max: Math.max(...vals) };
    });
    const totals = rows.map(r => r.total);
    const totalStats = { min: Math.min(...totals), max: Math.max(...totals) };
    const maxTotal = Math.max(...totals, 1);
    return { shiftNames, rows, colStats, totalStats, maxTotal };
  }, [data, search]);

  // ── render ────────────────────────────────────────────────────────────────

  const tabs = [
    { id: "general",        label: "כללי" },
    { id: "pointsSummary",  label: "סיכום נקודות" },
    { id: "byShift",        label: "לפי משמרת" },
    { id: "byDay",          label: "לפי יום" },
    { id: "byEmployee",     label: "לפי עובד" },
  ] as const;


  function handleTabChange(id: "general" | "pointsSummary" | "byShift" | "byDay" | "byEmployee") {
    setTab(id);
    if (id === "byShift") setSelectedShift(data?.shift_names[0] ?? null);
    if (id === "byDay") setSelectedDay(0);
    if (id === "byEmployee") {
      setSearch("");
      setSelectedEmployee(filteredEmployees[0] ?? null);
    } else {
      setSelectedEmployee(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">סטטיסטיקות</h1>
          <p className="text-slate-500 mt-1 text-sm">נתוני משמרות לפי טווח זמן</p>
        </div>


      </div>

      {/* Tabs + Search row */}
      <TabsContainer>
        {tabs.map((t) => (
          <TabButton
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            active={tab === t.id}
            className="px-5 py-2"
          >
            {t.label}
          </TabButton>
        ))}
      </TabsContainer>

      {/* Search and Date Controls */}
      <div className="flex items-center gap-2">
        {tab === "byEmployee" ? (
          <SearchDropdown
            value={effectiveEmployee ?? ""}
            onChange={() => {}}
            onSelect={setSelectedEmployee}
            selectMode
            options={data?.employees ?? []}
            placeholder="בחר עובד..."
            dir="rtl"
            className="w-48"
            renderOption={(emp, isSel) => {
              const total = data?.assignments.filter(a => a.employee_name === emp).length ?? 0;
              return (
                <span className="flex items-center justify-between w-full">
                  <span>{emp}</span>
                  <Badge className={isSel ? "bg-blue-200 text-blue-700 border-blue-300" : "bg-slate-100 text-slate-500 border-slate-200"}>{total}</Badge>
                </span>
              );
            }}
          />
        ) : (
          <SearchDropdown
            value={search}
            onChange={setSearch}
            options={data?.employees ?? []}
            placeholder="חיפוש עובד..."
            dir="rtl"
            className="w-48"
          />
        )}
        <DateRangePicker
          availableTypes={["week", "month", "year", "all", "custom"]}
          defaultType="month"
          onChange={setDateRange}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl shimmer" />
          ))}
        </div>
      ) : error ? (
        <Alert type="error">{error}</Alert>
      ) : !data ? null : (

        <div className="flex flex-col flex-1 min-h-0">
          {/* ── Tab 1: General ─────────────────────────────────────────────── */}
          {tab === "general" && (
            generalRows.length === 0 ? <EmptyState msg="אין נתונים בטווח הזמן הנבחר" /> : (
              <div className="flex flex-col flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 shrink-0">
                  <h2 className="font-semibold text-slate-800">סה״כ משמרות לעובד</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{data.assignments.length} משמרות בטווח הנבחר</p>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  {(() => {
                    const max = generalRows[0]?.count ?? 0;
                    return generalRows.map((row, i) => (
                      <BarRow key={row.name} name={row.name} count={row.count} max={max || 1} rank={i + 1} />
                    ));
                  })()}
                </div>
              </div>
            )
          )}

          {/* ── Tab 2: Points Summary ───────────────────────────────────────── */}
          {tab === "pointsSummary" && (
            !shiftSummary || shiftSummary.rows.length === 0 ? <EmptyState msg="אין נתונים בטווח הזמן הנבחר" /> : (
              <div className="flex flex-col flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden fade-in">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div>
                    <h2 className="font-semibold text-slate-800">סיכום משמרות לעובד</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{data.assignments.length} משמרות בטווח הנבחר</p>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full font-medium">גבוה / נמוך</span>
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-5 py-3 text-right font-semibold text-slate-600 whitespace-nowrap sticky top-0 bg-slate-50 z-10">#</th>
                        <th className="px-5 py-3 text-right font-semibold text-slate-600 whitespace-nowrap sticky top-0 bg-slate-50 z-10">עובד</th>
                        {shiftSummary.shiftNames.map((s, i) => (
                          <th key={s} className="px-3 py-3 text-center font-semibold whitespace-nowrap sticky top-0 bg-slate-50 z-10">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${SHIFT_COLORS[i % SHIFT_COLORS.length]}`}>{s}</span>
                          </th>
                        ))}
                        <th className="px-5 py-3 text-center font-bold text-slate-700 whitespace-nowrap sticky top-0 bg-slate-50 z-10">סה״כ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftSummary.rows.map((row, idx) => (
                        <tr key={row.name} className={`border-b border-slate-50 hover:bg-blue-50/30 ${idx % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                          <td className="px-5 py-3 text-slate-400 text-xs font-medium">{idx + 1}</td>
                          <td className="px-5 py-3 font-semibold text-slate-800 whitespace-nowrap">{row.name}</td>
                          {shiftSummary.shiftNames.map(s => {
                            const val = row.counts[s] ?? 0;
                            const { min, max } = shiftSummary.colStats[s];
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
                                row.total === shiftSummary.totalStats.max && shiftSummary.totalStats.min !== shiftSummary.totalStats.max ? "text-emerald-600" :
                                row.total === shiftSummary.totalStats.min && shiftSummary.totalStats.min !== shiftSummary.totalStats.max ? "text-red-500" :
                                "text-slate-700"
                              }`}>{row.total}</span>
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(row.total / shiftSummary.maxTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ── Tab 2: By shift ────────────────────────────────────────────── */}
          {tab === "byShift" && (
            <div className="flex flex-col flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 shrink-0">
                {data.shift_names.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">אין משמרות בטווח הנבחר</p>
                ) : (
                  <Select
                    optionPrefix="הצג נתונים למשמרת"
                    value={selectedShift ?? ""}
                    onChange={e => setSelectedShift(e.target.value || null)}
                  >
                    {data.shift_names.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                )}
              </div>

              {selectedShift && (
                <>
                  <div className="px-6 py-3 border-t border-slate-100 bg-violet-50 shrink-0">
                    <p className="text-sm font-semibold text-violet-700">
                      משמרת: {selectedShift} — {byShiftRows.filter(r => r.count > 0).length} עובדים עשו אותה
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
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

          {/* ── Tab 3: By day ──────────────────────────────────────────────── */}
          {tab === "byDay" && (
            <div className="flex flex-col flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 shrink-0">
                <Select
                  optionPrefix="הצג נתונים ליום"
                  value={selectedDay ?? ""}
                  onChange={e => setSelectedDay(e.target.value === "" ? null : Number(e.target.value))}
                >
                  {DOW_LABELS.map((label, i) => (
                    <option key={i} value={i}>{label}</option>
                  ))}
                </Select>
              </div>

              {selectedDay !== null && (
                <>
                  <div className="px-6 py-3 border-t border-slate-100 bg-violet-50 shrink-0">
                    <p className="text-sm font-semibold text-violet-700">
                      יום {DOW_LABELS[selectedDay]} — {byDayRows.filter(r => r.count > 0).length} עובדים
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
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

          {/* ── Tab 4: By employee ─────────────────────────────────────────── */}
          {tab === "byEmployee" && (
            <div className="space-y-4">
              {effectiveEmployee && (
                <p className="text-sm text-slate-500" dir="rtl">
                  סה&quot;כ {data.assignments.filter(a => a.employee_name === effectiveEmployee).length} משמרות בטווח הנבחר עבור {effectiveEmployee}
                </p>
              )}

              {effectiveEmployee && (
                <>
                  {/* Per shift + Per day side by side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>

                  {/* Shift List Breakdown */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                      <h3 className="font-semibold text-slate-800">פירוט רשימת משמרות</h3>
                      <p className="text-xs text-slate-400 mt-0.5">כל המשמרות בטווח הזמן שנבחר</p>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {empAssignments.length === 0 ? (
                        <EmptyState msg="אין משמרות להצגה" />
                      ) : (
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 sticky top-0 border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-3 text-right font-medium text-slate-500">תאריך</th>
                              <th className="px-6 py-3 text-right font-medium text-slate-500">יום</th>
                              <th className="px-6 py-3 text-right font-medium text-slate-500">משמרת</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {empAssignments.map((a, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-3 text-slate-700 tabular-nums">
                                  {a.date ? new Date(a.date).toLocaleDateString("he-IL") : "—"}
                                </td>
                                <td className="px-6 py-3 text-slate-600">
                                  {DOW_LABELS[a.day_of_week]}
                                </td>
                                <td className="px-6 py-3 font-semibold text-slate-800">
                                  {a.shift_name}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
      </div>

    </div>
  );
}
