"use client";
import { useState, useEffect } from "react";
import { useSpecialShifts } from "@/hooks/useShiftComposition";
import { ShiftType } from "@/lib/types";

const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

/**
 * Count the number of calendar weeks (rows) in the given month.
 * Week starts on Sunday (day 0) — Israeli convention.
 * e.g. March 2026 starts on Sunday → 5 weeks.
 */
function weeksInMonth(year: number, month: number): number {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  // firstDay.getDay() is 0 for Sunday (start of week in Israel)
  return Math.ceil((lastDay + firstDay.getDay()) / 7);
}

/**
 * Randomly distribute `total` shifts across `weeks` weeks.
 * Uses a partial Fisher-Yates shuffle so the extra shifts (total % weeks)
 * land on random weeks rather than always the first ones.
 */
function randomDistribute(total: number, weeks: number): number[] {
  if (weeks <= 0 || total <= 0) return Array(Math.max(weeks, 1)).fill(0);
  const base = Math.floor(total / weeks);
  const extra = total % weeks;
  const result = Array(weeks).fill(base);
  const indices = Array.from({ length: weeks }, (_, i) => i);
  for (let i = 0; i < extra; i++) {
    const j = i + Math.floor(Math.random() * (weeks - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
    result[indices[i]]++;
  }
  return result;
}

function SingleShiftConfig({
  shiftName,
  year,
  month,
  weeks,
  getCount,
  getDistribution,
  saveMonth,
}: {
  shiftName: string;
  year: number;
  month: number;
  weeks: number;
  getCount: (m: number, name?: string) => number;
  getDistribution: (m: number, name?: string) => number[] | undefined;
  saveMonth: (m: number, count: number, dist?: number[], shiftName?: string) => Promise<void>;
}) {
  const currentCount = getCount(month, shiftName);
  const savedDistribution = getDistribution(month, shiftName);

  const [draftCount, setDraftCount] = useState<number | null>(null);
  const [draftDistribution, setDraftDistribution] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset draft when month/year changes
  useEffect(() => {
    setDraftCount(null);
    setDraftDistribution(null);
  }, [month, year, shiftName]);

  const displayCount = draftCount ?? currentCount;
  const displayDistribution = draftDistribution ?? savedDistribution ?? (currentCount > 0 ? randomDistribute(currentCount, weeks) : Array(weeks).fill(0));

  const updateCount = (n: number) => {
    const clamped = Math.max(0, Math.min(31, n));
    setDraftCount(clamped);
    setDraftDistribution(randomDistribute(clamped, weeks));
  };

  const reshuffle = () => {
    if (displayCount > 0) setDraftDistribution(randomDistribute(displayCount, weeks));
    if (draftCount === null) setDraftCount(currentCount); // mark dirty
  };

  const handleSave = async () => {
    if (draftCount === null) return;
    setSaving(true);
    try {
      await saveMonth(month, draftCount, draftDistribution ?? undefined, shiftName);
      setDraftCount(null);
      setDraftDistribution(null);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = draftCount !== null && (draftCount !== currentCount || draftDistribution !== null);

  return (
    <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
      <div className="flex items-center justify-between gap-4 mb-4">
        <span className="text-sm font-bold text-slate-700">{shiftName}</span>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <span className="text-sm text-slate-600 font-medium">מספר משמרות מיוחדות:</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => updateCount(displayCount - 1)}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm flex items-center justify-center transition-colors">−</button>
            <input
              type="number" min={0} max={31} value={displayCount}
              onChange={e => updateCount(parseInt(e.target.value) || 0)}
              className="w-16 text-center text-xl font-bold border-2 border-slate-200 rounded-xl py-1 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            />
            <button type="button" onClick={() => updateCount(displayCount + 1)}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm flex items-center justify-center transition-colors">+</button>
          </div>
          {isDirty && (
            <button type="button" disabled={saving} onClick={handleSave}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "שומר..." : "שמור"}
            </button>
          )}
        </div>
      </div>

      {/* Weekly distribution preview */}
      {displayCount > 0 && (
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500">חלוקה שבועית ({weeks} שבועות)</p>
              <button type="button" onClick={reshuffle}
                title="ערבב מחדש"
                className="flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-800 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                ערבב
              </button>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              {displayDistribution.map((count, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${
                    count > 0 ? "bg-purple-100 text-purple-700 border border-purple-200" : "bg-slate-100 text-slate-400"
                  }`}>
                    {count}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">שבוע {i + 1}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-slate-400 mt-3">
            {displayCount} משמרות "{shiftName}" יחולקו רנדומלית בין העובדים
            </p>
        </div>
      )}
    </div>
  );
}

export default function SpecialShiftMonthlyConfig({ shiftTypes }: { shiftTypes: ShiftType[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based
  const { getCount, getDistribution, setMonth: saveMonth, loading } = useSpecialShifts(year);

  const weeks = weeksInMonth(year, month);

  // Filter shift types that are "special" or explicitly named "משמרת מיוחדת"
  const specialShifts = shiftTypes
    .filter(st => st.is_special || st.names.includes("משמרת מיוחדת"))
    .map(st => st.names[0]);
  
  // Dedupe names
  const uniqueShiftNames = Array.from(new Set(specialShifts));

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-800">מכסות משמרות חודשיות</h2>
          <p className="text-xs text-slate-500 mt-0.5">הגדר כמות משמרות לכל חודש עבור סוגים מיוחדים — המערכת תחלק אותן רנדומלית</p>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Month navigation */}
        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={prevMonth}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="text-base font-semibold text-slate-800 w-32 text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button type="button" onClick={nextMonth}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="h-32 rounded-xl shimmer" />
        ) : uniqueShiftNames.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm">לא נמצאו משמרות המוגדרות כ"מיוחדות"</p>
          </div>
        ) : (
          <div className="space-y-4">
            {uniqueShiftNames.map(name => (
              <SingleShiftConfig 
                key={name}
                shiftName={name}
                year={year}
                month={month}
                weeks={weeks}
                getCount={getCount}
                getDistribution={getDistribution}
                saveMonth={saveMonth}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
