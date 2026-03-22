"use client";
import { useEffect, useState } from "react";
import { getJustice, getAdvocates, addAdvocate, removeAdvocate, getEmployees, getShirking, removeShirking, getDayTypeJustice, getJusticeBreakdown, getVolunteerBreakdown, getDayTypeBreakdown, type JusticeEntry, type Advocate, type Employee, type ShirkingRecord, type DayTypeJusticeData, type JusticeBreakdown, type VolunteerBreakdown, type DayTypeBreakdown } from "@/lib/api";

type Tab = "justice" | "volunteer" | "combined" | "advocates" | "shirking" | "daytype";
type View = "table" | "chart";
type RangeType = "week" | "month" | "year";

// ── Date range helpers ────────────────────────────────────────────────────────
function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getRangeBounds(type: RangeType, ref: Date): { start: Date; end: Date } {
  const d = new Date(ref);
  if (type === "week") {
    const day = d.getDay(); // 0=Sun
    const sun = new Date(d); sun.setDate(d.getDate() - day);
    const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
    return { start: sun, end: sat };
  }
  if (type === "month") {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { start, end };
  }
  // year
  const start = new Date(d.getFullYear(), 0, 1);
  const end = new Date(d.getFullYear(), 11, 31);
  return { start, end };
}

function shiftRef(type: RangeType, ref: Date, dir: -1 | 1): Date {
  const d = new Date(ref);
  if (type === "week")  d.setDate(d.getDate() + dir * 7);
  if (type === "month") d.setMonth(d.getMonth() + dir);
  if (type === "year")  d.setFullYear(d.getFullYear() + dir);
  return d;
}

const HE_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function formatRange(type: RangeType, start: Date, end: Date): string {
  if (type === "year")  return `${start.getFullYear()}`;
  if (type === "month") return `${HE_MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  // week
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) return `${start.getDate()}–${end.getDate()} ${HE_MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  return `${start.getDate()} ${HE_MONTHS[start.getMonth()]} – ${end.getDate()} ${HE_MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

const RANK_COLORS = [
  "bg-amber-400 text-white",
  "bg-slate-300 text-slate-700",
  "bg-orange-300 text-white",
];

function RankBadge({ rank }: { rank: number }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
      RANK_COLORS[rank] ?? "bg-slate-100 text-slate-500"
    }`}>
      {rank + 1}
    </div>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden min-w-[80px]">
      <div className={`h-6 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%`, minWidth: value > 0 ? "1.5rem" : "0" }} />
      <span className="absolute inset-y-0 right-2 flex items-center text-xs font-bold text-slate-700">
        {value}
      </span>
    </div>
  );
}

// ── Breakdown modal ───────────────────────────────────────────────────────────
const DES_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-700",
  2: "bg-orange-100 text-orange-700",
  3: "bg-slate-100 text-slate-600",
  4: "bg-yellow-100 text-yellow-700",
  5: "bg-emerald-100 text-emerald-700",
};

function BreakdownModal({ employee, startDate, endDate, onClose }: {
  employee: string;
  startDate?: string;
  endDate?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<JusticeBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJusticeBreakdown(employee, startDate, endDate)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [employee, startDate, endDate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">{employee}</h2>
            <p className="text-xs text-slate-400 mt-0.5">פירוט חישוב ניקוד צדק</p>
          </div>
          {data && (
            <div className="text-2xl font-bold text-blue-600 ml-4">{data.total} נק׳</div>
          )}
          <button onClick={onClose} className="ml-3 text-slate-400 hover:text-slate-600 transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">טוען...</div>
          ) : !data || data.rows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">אין נתוני משמרות בטווח הנבחר</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">תאריך</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">יום</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">משמרת</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 whitespace-nowrap">רצויות</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 whitespace-nowrap">נק׳ משמרת</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 whitespace-nowrap">נק׳ יום</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">סה״כ</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i} className={`border-b border-slate-50 hover:bg-blue-50/30 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap tabular-nums">{row.date}</td>
                    <td className="px-4 py-2.5 text-slate-700 font-medium whitespace-nowrap">{row.day_of_week}</td>
                    <td className="px-4 py-2.5 text-slate-800 font-semibold whitespace-nowrap">{row.shift_name}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${DES_COLORS[row.desirability] ?? "bg-slate-100 text-slate-600"}`}>
                        {"★".repeat(row.desirability)}{"☆".repeat(5 - row.desirability)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold text-blue-600">{row.desirability_points}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-slate-500">
                      {row.weekday_score > 0 ? <span className="text-amber-600">+{row.weekday_score}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-slate-800">{row.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white border-t-2 border-slate-200">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right font-bold text-slate-700">סה״כ</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-600 text-base">{data.total}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Volunteer Breakdown modal ──────────────────────────────────────────────────
function VolunteerBreakdownModal({ employee, startDate, endDate, onClose }: {
  employee: string;
  startDate?: string;
  endDate?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<VolunteerBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVolunteerBreakdown(employee, startDate, endDate)
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [employee, startDate, endDate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">{employee}</h2>
            <p className="text-xs text-slate-400 mt-0.5">פירוט חישוב ניקוד התנדבות</p>
          </div>
          {data && <div className="text-2xl font-bold text-green-600 ml-4">{data.total} נק׳</div>}
          <button onClick={onClose} className="ml-3 text-slate-400 hover:text-slate-600 transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">טוען...</div>
          ) : !data || data.rows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">אין נתוני התנדבויות בטווח הנבחר</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">תאריך</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">יום</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">משמרת</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 whitespace-nowrap">רצויות</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">נק׳</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i} className={`border-b border-slate-50 hover:bg-green-50/30 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap tabular-nums">{row.date}</td>
                    <td className="px-4 py-2.5 text-slate-700 font-medium whitespace-nowrap">{row.day_of_week}</td>
                    <td className="px-4 py-2.5 text-slate-800 font-semibold whitespace-nowrap">{row.shift_name}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${DES_COLORS[row.desirability] ?? "bg-slate-100 text-slate-600"}`}>
                        {"★".repeat(row.desirability)}{"☆".repeat(5 - row.desirability)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-green-600">{row.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white border-t-2 border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-bold text-slate-700">סה״כ</td>
                  <td className="px-4 py-3 text-center font-bold text-green-600 text-base">{data.total}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DayType Breakdown modal ────────────────────────────────────────────────────
function DayTypeBreakdownModal({ employee, startDate, endDate, onClose }: {
  employee: string;
  startDate?: string;
  endDate?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<DayTypeBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDayTypeBreakdown(employee, startDate, endDate)
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [employee, startDate, endDate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">{employee}</h2>
            <p className="text-xs text-slate-400 mt-0.5">פירוט חישוב ניקוד שבתות וחגים</p>
          </div>
          {data && <div className="text-2xl font-bold text-purple-600 ml-4">{data.total} נק׳</div>}
          <button onClick={onClose} className="ml-3 text-slate-400 hover:text-slate-600 transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">טוען...</div>
          ) : !data || data.rows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">אין נתוני שבתות / חגים בטווח הנבחר</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">תאריך</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">יום</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">משמרת</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 whitespace-nowrap">שבת נק׳</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 whitespace-nowrap">חג</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">סה״כ</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i} className={`border-b border-slate-50 hover:bg-purple-50/30 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap tabular-nums">{row.date}</td>
                    <td className="px-4 py-2.5 text-slate-700 font-medium whitespace-nowrap">{row.day_of_week}</td>
                    <td className="px-4 py-2.5 text-slate-800 font-semibold whitespace-nowrap">{row.shift_name}</td>
                    <td className="px-4 py-2.5 text-center">
                      {row.is_shabbat
                        ? <span className="font-semibold text-purple-600">{row.shabbat_score}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {row.day_type
                        ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${row.day_type_color ?? "bg-slate-100 text-slate-600"}`}>{row.day_type} +{row.day_type_score}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-purple-700">{row.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white border-t-2 border-slate-200">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">סה״כ</td>
                  <td className="px-4 py-3 text-center font-bold text-purple-600 text-base">{data.total}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Justice section ───────────────────────────────────────────────────────────
function JusticeSection({ data, view, search, getDayScore, onEmployeeClick }: { data: JusticeEntry[]; view: View; search: string; getDayScore?: (name: string) => number; onEmployeeClick?: (name: string) => void }) {
  const q = search.trim().toLowerCase();
  const sorted = [...data]
    .filter(e => !q || e.employee_name.toLowerCase().includes(q))
    .sort((a, b) => b.justice_score - a.justice_score);
  const max = sorted[0]?.justice_score ?? 1;

  if (view === "chart") {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">גרף טבלת צדק</h3>
          <p className="text-xs text-slate-400 mt-0.5">כל עמודה = סכום נקודות הסבל (1★ = 10 נק׳, 2★ = 7 נק׳, 3★ = 4 נק׳, 4★ = 2 נק׳, 5★ = 1 נק׳)</p>
        </div>
        <div className="p-6">
          <div className="flex items-end gap-3 h-48 border-b border-slate-200 pb-2 overflow-x-auto">
            {sorted.map((e, i) => {
              const barH = max > 0 ? Math.max(e.justice_score > 0 ? 4 : 0, Math.round((e.justice_score / max) * 150)) : 0;
              return (
                <div key={e.employee_id} className="flex flex-col items-center gap-1 min-w-[52px]">
                  <span className="text-xs font-bold text-slate-600">{e.justice_score}</span>
                  <div className="w-10 rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${barH}px`,
                      background: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#fb923c" : "#60a5fa",
                    }} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 mt-2 overflow-x-auto">
            {sorted.map((e) => (
              <div key={e.employee_id} className="min-w-[52px] text-center text-[10px] text-slate-500 truncate">{e.employee_name}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-slate-800">טבלת צדק</h3>
          <p className="text-xs text-slate-400 mt-0.5">ניקוד לפי משמרות לא רצויות — ככל שהציון גבוה יותר, מגיע לעובד עדיפות</p>
        </div>
        <div className="flex gap-3 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"/>1★ = 10 נק׳</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block"/>2★ = 7 נק׳</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"/>3★ = 4 נק׳</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"/>4★ = 2 נק׳</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"/>5★ = 1 נק׳</span>
        </div>
      </div>
      <div className="p-5 space-y-2.5">
        {sorted.map((e, rank) => (
          <div
            key={e.employee_id}
            className={`flex items-center gap-3 rounded-xl px-2 py-1 -mx-2 transition-colors ${onEmployeeClick ? "cursor-pointer hover:bg-blue-50" : ""}`}
            onClick={() => onEmployeeClick?.(e.employee_name)}
            title={onEmployeeClick ? "לחץ לפירוט" : undefined}
          >
            <RankBadge rank={rank} />
            <div className="w-28 text-sm font-semibold text-slate-800 shrink-0 truncate">{e.employee_name}</div>
            <Bar value={e.justice_score} max={max} color={rank === 0 ? "bg-amber-400" : rank === 1 ? "bg-slate-300" : rank === 2 ? "bg-orange-300" : "bg-blue-400"} />
            <div className="text-xs text-slate-400 shrink-0 w-20 text-left">{e.justice_shifts} משמרות</div>
            {getDayScore && (
              <div className="text-sm font-bold text-purple-600 shrink-0 w-16 text-center" title="ניקוד שבת/חגים">
                {getDayScore(e.employee_name)}🕍
              </div>
            )}
            {getDayScore && (
              <div className="text-sm font-bold text-slate-800 shrink-0 w-16 text-center" title="סה״כ">
                {e.justice_score + getDayScore(e.employee_name)}
              </div>
            )}
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">אין נתוני סידורים עדיין</p>
        )}
      </div>
      {getDayScore && (
        <div className="px-6 pb-3 flex gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block"/>ניקוד שבת/חגים</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block"/>סה״כ = צדק + שבת/חגים</span>
        </div>
      )}
    </div>
  );
}

// ── Volunteer section ─────────────────────────────────────────────────────────
function VolunteerSection({ data, view, search, getDayScore, onEmployeeClick }: { data: JusticeEntry[]; view: View; search: string; getDayScore?: (name: string) => number; onEmployeeClick?: (name: string) => void }) {
  const q = search.trim().toLowerCase();
  const sorted = [...data]
    .filter(e => !q || e.employee_name.toLowerCase().includes(q))
    .sort((a, b) => b.volunteer_score - a.volunteer_score);
  const max = sorted[0]?.volunteer_score ?? 1;

  if (view === "chart") {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">גרף טבלת התנדבות</h3>
          <p className="text-xs text-slate-400 mt-0.5">ניקוד התנדבות לפי רמת המשמרות</p>
        </div>
        <div className="p-6">
          <div className="flex items-end gap-3 h-48 border-b border-slate-200 pb-2 overflow-x-auto">
            {sorted.map((e, i) => {
              const barH = max > 0 ? Math.max(e.volunteer_score > 0 ? 4 : 0, Math.round((e.volunteer_score / max) * 150)) : 0;
              return (
                <div key={e.employee_id} className="flex flex-col items-center gap-1 min-w-[52px]">
                  <span className="text-xs font-bold text-slate-600">{e.volunteer_score}</span>
                  <div className="w-10 rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${barH}px`,
                      background: i === 0 ? "#22c55e" : i === 1 ? "#86efac" : "#bbf7d0",
                    }} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 mt-2 overflow-x-auto">
            {sorted.map((e) => (
              <div key={e.employee_id} className="min-w-[52px] text-center text-[10px] text-slate-500 truncate">{e.employee_name}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="font-bold text-slate-800">טבלת התנדבות</h3>
        <p className="text-xs text-slate-400 mt-0.5">ניקוד לפי כמות ואיכות ההתנדבויות — ממשמרת לא רצויה מקבלים יותר נקודות</p>
      </div>
      <div className="p-5 space-y-2.5">
        {sorted.map((e, rank) => (
          <div
            key={e.employee_id}
            className={`flex items-center gap-3 rounded-xl px-2 py-1 -mx-2 transition-colors ${onEmployeeClick ? "cursor-pointer hover:bg-green-50" : ""}`}
            onClick={() => onEmployeeClick?.(e.employee_name)}
            title={onEmployeeClick ? "לחץ לפירוט" : undefined}
          >
            <RankBadge rank={rank} />
            <div className="w-28 text-sm font-semibold text-slate-800 shrink-0 truncate">{e.employee_name}</div>
            <Bar value={e.volunteer_score} max={max} color={rank === 0 ? "bg-green-500" : rank === 1 ? "bg-green-300" : "bg-green-200"} />
            <div className="text-xs text-slate-400 shrink-0 w-24 text-left">{e.volunteer_count} התנדבויות</div>
            {getDayScore && (
              <div className="text-sm font-bold text-purple-600 shrink-0 w-16 text-center" title="ניקוד שבת/חגים">
                {getDayScore(e.employee_name)}🕍
              </div>
            )}
            {getDayScore && (
              <div className="text-sm font-bold text-slate-800 shrink-0 w-16 text-center" title="סה״כ">
                {e.volunteer_score + getDayScore(e.employee_name)}
              </div>
            )}
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">אין נתוני התנדבויות עדיין</p>
        )}
      </div>
      {getDayScore && (
        <div className="px-6 pb-3 flex gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block"/>ניקוד שבת/חגים</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block"/>סה״כ = התנדבות + שבת/חגים</span>
        </div>
      )}
    </div>
  );
}

// ── Combined chart ────────────────────────────────────────────────────────────
function CombinedChart({ data, search }: { data: JusticeEntry[]; search: string }) {
  const q = search.trim().toLowerCase();
  const filtered = data.filter(e => !q || e.employee_name.toLowerCase().includes(q));
  const maxJ = Math.max(...filtered.map(e => e.justice_score), 1);
  const maxV = Math.max(...filtered.map(e => e.volunteer_score), 1);
  const sorted = [...filtered].sort((a, b) => (b.justice_score + b.volunteer_score) - (a.justice_score + a.volunteer_score));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="font-bold text-slate-800">גרף משולב — צדק + התנדבות</h3>
        <p className="text-xs text-slate-400 mt-0.5">כחול = צדק, ירוק = התנדבות</p>
      </div>
      <div className="p-6">
        <div className="flex items-end gap-4 h-48 border-b border-slate-200 pb-2 overflow-x-auto">
          {sorted.map((e) => {
            const barJ = maxJ > 0 ? Math.max(e.justice_score > 0 ? 4 : 0, Math.round((e.justice_score / maxJ) * 100)) : 0;
            const barV = maxV > 0 ? Math.max(e.volunteer_score > 0 ? 4 : 0, Math.round((e.volunteer_score / maxV) * 100)) : 0;
            return (
              <div key={e.employee_id} className="flex flex-col items-center gap-1 min-w-[64px]">
                <div className="flex items-end gap-1 h-32">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-blue-600 font-bold">{e.justice_score}</span>
                    <div className="w-5 rounded-t-lg bg-blue-400 transition-all duration-500"
                      style={{ height: `${barJ}px` }} />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-green-600 font-bold">{e.volunteer_score}</span>
                    <div className="w-5 rounded-t-lg bg-green-400 transition-all duration-500"
                      style={{ height: `${barV}px` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-2 overflow-x-auto">
          {sorted.map((e) => (
            <div key={e.employee_id} className="min-w-[64px] text-center text-[10px] text-slate-500 truncate">{e.employee_name}</div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-400 inline-block"/>צדק</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-400 inline-block"/>התנדבות</span>
        </div>
      </div>
    </div>
  );
}

// ── Combined table ────────────────────────────────────────────────────────────
function CombinedTable({ data, search }: { data: JusticeEntry[]; search: string }) {
  const q = search.trim().toLowerCase();
  const filtered = data.filter(e => !q || e.employee_name.toLowerCase().includes(q));
  const sorted = [...filtered].sort((a, b) => (b.justice_score + b.volunteer_score) - (a.justice_score + a.volunteer_score));
  const maxJ = Math.max(...filtered.map(e => e.justice_score), 1);
  const maxV = Math.max(...filtered.map(e => e.volunteer_score), 1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="font-bold text-slate-800">טבלה משולבת — צדק + התנדבות</h3>
        <p className="text-xs text-slate-400 mt-0.5">ממוין לפי סה״כ נקודות (צדק + התנדבות)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 font-semibold text-slate-500 w-10 text-center">#</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">עובד</th>
              <th className="px-4 py-3 font-semibold text-blue-600 text-center">ניקוד צדק</th>
              <th className="px-4 py-3 font-semibold text-green-600 text-center">ניקוד התנדבות</th>
              <th className="px-4 py-3 font-semibold text-slate-700 text-center">סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, rank) => {
              const total = e.justice_score + e.volunteer_score;
              const pctJ = maxJ > 0 ? (e.justice_score / maxJ) * 100 : 0;
              const pctV = maxV > 0 ? (e.volunteer_score / maxV) * 100 : 0;
              return (
                <tr key={e.employee_id} className={`border-b border-slate-50 hover:bg-slate-50 ${rank % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                  <td className="px-4 py-3 text-center"><RankBadge rank={rank} /></td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{e.employee_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                        <div className="h-4 bg-blue-400 rounded-full" style={{ width: `${pctJ}%` }} />
                      </div>
                      <span className="text-xs font-bold text-blue-600 w-8 text-left">{e.justice_score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                        <div className="h-4 bg-green-400 rounded-full" style={{ width: `${pctV}%` }} />
                      </div>
                      <span className="text-xs font-bold text-green-600 w-8 text-left">{e.volunteer_score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-bold text-slate-800">{total}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Advocates section ─────────────────────────────────────────────────────────
function AdvocatesSection({ employees, search }: { employees: Employee[]; search: string }) {
  const [advocates, setAdvocates] = useState<Advocate[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [advView, setAdvView] = useState<View>("table");
  const [form, setForm] = useState({ employee_id: "", description: "", points: 1, date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState("");
  const [empOpen, setEmpOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    getAdvocates()
      .then(setAdvocates)
      .catch(e => setFetchError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee_id || !form.description) return;
    const emp = employees.find(em => em.id === form.employee_id);
    if (!emp) return;
    setSaving(true);
    setSaveError(null);
    try {
      const added = await addAdvocate({ ...form, employee_name: emp.name, points: Number(form.points) });
      setAdvocates(prev => [added, ...prev]);
      setForm(f => ({ ...f, employee_id: "", description: "", points: 1 }));
      setEmpSearch("");
      setShowForm(false);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await removeAdvocate(id);
      setAdvocates(prev => prev.filter(a => a.id !== id));
    } catch {
      // ignore
    }
  }

  // Aggregate totals per employee
  const totals: Record<string, { name: string; points: number; count: number }> = {};
  for (const a of advocates) {
    totals[a.employee_id] ??= { name: a.employee_name, points: 0, count: 0 };
    totals[a.employee_id].points += a.points;
    totals[a.employee_id].count += 1;
  }
  const q = search.trim().toLowerCase();
  const sorted = Object.entries(totals)
    .filter(([, info]) => !q || info.name.toLowerCase().includes(q))
    .sort((a, b) => b[1].points - a[1].points);
  const maxPts = sorted[0]?.[1].points ?? 1;

  const filtered = selectedEmployee
    ? advocates.filter(a => a.employee_id === selectedEmployee)
    : advocates;

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl shimmer" />)}</div>;

  if (fetchError) return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{fetchError}</div>
  );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* View toggle */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          <button type="button" onClick={() => setAdvView("table")}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${advView === "table" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M.99 5.24A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25l.01 9.5A2.25 2.25 0 0 1 16.76 17H3.26A2.272 2.272 0 0 1 1 14.76l-.01-9.5Zm8.26 9.52v-.625a.75.75 0 0 0-.75-.75H3.25a.75.75 0 0 0-.75.75v.615c0 .414.336.75.75.75h5.09a.75.75 0 0 0 .91-.74Zm1.5 0a.75.75 0 0 0 .91.74h5.09a.75.75 0 0 0 .75-.75v-.615a.75.75 0 0 0-.75-.75H11.5a.75.75 0 0 0-.75.75v.625Zm6.75-3.63v-.625a.75.75 0 0 0-.75-.75H11.5a.75.75 0 0 0-.75.75v.625c0 .414.336.75.75.75h5.25a.75.75 0 0 0 .75-.75Zm-8.25 0v-.625a.75.75 0 0 0-.75-.75H3.25a.75.75 0 0 0-.75.75v.625c0 .414.336.75.75.75H8.5a.75.75 0 0 0 .75-.75Z" clipRule="evenodd"/>
            </svg>
            טבלה
          </button>
          <button type="button" onClick={() => setAdvView("chart")}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${advView === "chart" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2ZM9.5 7A1.5 1.5 0 0 0 8 8.5v8a1.5 1.5 0 0 0 3 0v-8A1.5 1.5 0 0 0 9.5 7ZM3.5 12A1.5 1.5 0 0 0 2 13.5v3a1.5 1.5 0 0 0 3 0v-3A1.5 1.5 0 0 0 3.5 12Z"/>
            </svg>
            גרף
          </button>
        </div>

        <button type="button" onClick={() => { setShowForm(v => !v); setSaveError(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-sm">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z"/></svg>
          הוסף סנגור
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-slate-800">סנגור חדש</h3>
          {saveError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{saveError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">עובד</label>
              <div className="relative">
                <input
                  type="text"
                  value={empSearch}
                  onChange={e => { setEmpSearch(e.target.value); setEmpOpen(true); setForm(f => ({ ...f, employee_id: "" })); }}
                  onFocus={() => setEmpOpen(true)}
                  placeholder="הקלד שם עובד..."
                  autoComplete="off"
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${form.employee_id ? "border-blue-300 bg-blue-50/40" : "border-slate-200"}`}
                />
                {form.employee_id && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 text-xs">✓</span>
                )}
                {empOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setEmpOpen(false)} />
                    <div className="absolute z-50 top-full mt-1 right-0 left-0 bg-white rounded-xl shadow-xl border border-slate-200 max-h-52 overflow-y-auto" dir="rtl">
                      {employees
                        .filter(em => !empSearch.trim() || em.name.toLowerCase().includes(empSearch.toLowerCase()))
                        .map(em => (
                          <button key={em.id} type="button"
                            onClick={() => { setForm(f => ({ ...f, employee_id: em.id })); setEmpSearch(em.name); setEmpOpen(false); }}
                            className={`w-full text-right px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${form.employee_id === em.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700"}`}>
                            {em.name}
                          </button>
                        ))}
                      {employees.filter(em => !empSearch.trim() || em.name.toLowerCase().includes(empSearch.toLowerCase())).length === 0 && (
                        <p className="text-center text-slate-400 text-sm py-3">לא נמצאו עובדים</p>
                      )}
                    </div>
                  </>
                )}
              </div>
              {/* Hidden required validation anchor */}
              <input type="text" required readOnly value={form.employee_id} className="sr-only" tabIndex={-1} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">תאריך</label>
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">תיאור הסנגור</label>
              <input required type="text" value={form.description} placeholder="מה עשה העובד?"
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">נקודות</label>
              <input required type="number" min={1} max={100} value={form.points}
                onChange={e => setForm(f => ({ ...f, points: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-all">ביטול</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all disabled:opacity-50">
              {saving ? "שומר..." : "שמור"}
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {advocates.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-12">אין סנגורים עדיין — לחץ על &quot;הוסף סנגור&quot; כדי להתחיל</p>
      )}

      {/* Chart view */}
      {sorted.length > 0 && advView === "chart" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">גרף סנגורים</h3>
            <p className="text-xs text-slate-400 mt-0.5">גובה העמודה = סך הנקודות</p>
          </div>
          <div className="p-6">
            <div className="flex items-end gap-3 h-48 border-b border-slate-200 pb-2 overflow-x-auto">
              {sorted.map(([empId, info], i) => {
                const barH = maxPts > 0 ? Math.max(info.points > 0 ? 4 : 0, Math.round((info.points / maxPts) * 150)) : 0;
                return (
                  <div key={empId} className="flex flex-col items-center gap-1 min-w-[52px]">
                    <span className="text-xs font-bold text-slate-600">{info.points}</span>
                    <div className="w-10 rounded-t-lg transition-all duration-500"
                      style={{
                        height: `${barH}px`,
                        background: i === 0 ? "#a855f7" : i === 1 ? "#c084fc" : i === 2 ? "#d8b4fe" : "#e9d5ff",
                      }} />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 mt-2 overflow-x-auto">
              {sorted.map(([empId, info]) => (
                <div key={empId} className="min-w-[52px] text-center text-[10px] text-slate-500 truncate">{info.name}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table view */}
      {sorted.length > 0 && advView === "table" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">דירוג סנגורים</h3>
            <p className="text-xs text-slate-400 mt-0.5">לחץ על עובד לראות את הסנגורים שלו</p>
          </div>
          <div className="p-5 space-y-2.5">
            {sorted.map(([empId, info], rank) => (
              <div key={empId}
                onClick={() => setSelectedEmployee(selectedEmployee === empId ? null : empId)}
                className={`flex items-center gap-3 cursor-pointer rounded-xl p-2 -mx-2 transition-all ${selectedEmployee === empId ? "bg-purple-50" : "hover:bg-slate-50"}`}>
                <RankBadge rank={rank} />
                <div className="w-28 text-sm font-semibold text-slate-800 shrink-0 truncate">{info.name}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden min-w-[80px]">
                  <div className="h-6 rounded-full bg-purple-400 transition-all duration-500"
                    style={{ width: `${maxPts > 0 ? (info.points / maxPts) * 100 : 0}%`, minWidth: info.points > 0 ? "1.5rem" : "0" }} />
                  <span className="absolute inset-y-0 right-2 flex items-center text-xs font-bold text-slate-700">{info.points}</span>
                </div>
                <div className="text-xs text-slate-400 shrink-0 w-20 text-left">{info.count} סנגורים</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-employee entries */}
      {selectedEmployee && advView === "table" && (
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-purple-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">סנגורים של {totals[selectedEmployee]?.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{filtered.length} רשומות · {filtered.reduce((s, a) => s + a.points, 0)} נקודות</p>
            </div>
            <button type="button" onClick={() => setSelectedEmployee(null)} className="text-slate-400 hover:text-slate-600 transition-all">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/></svg>
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {filtered.map(a => (
              <div key={a.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-all">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{a.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{a.date}</p>
                </div>
                <span className="text-sm font-bold text-purple-600 shrink-0">{a.points} נק׳</span>
                <button type="button" onClick={() => handleDelete(a.id)} className="text-slate-300 hover:text-red-400 transition-all shrink-0">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd"/></svg>
                </button>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-slate-400 text-sm py-8">אין סנגורים עדיין</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shirking section ──────────────────────────────────────────────────────────
function ShirkingSection({ search, volunteerData }: {
  search: string;
  volunteerData?: JusticeEntry[];
}) {
  const [records, setRecords] = useState<ShirkingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sideBySide, setSideBySide] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getShirking()
      .then(setRecords)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    await removeShirking(id).catch(() => {});
    setRecords(prev => prev.filter(r => r.id !== id));
  }

  const q = search.trim().toLowerCase();

  // Aggregate per employee
  const totals: Record<string, { name: string; count: number }> = {};
  for (const r of records) {
    totals[r.employee_id] ??= { name: r.employee_name, count: 0 };
    totals[r.employee_id].count++;
  }
  const sorted = Object.entries(totals)
    .filter(([, info]) => !q || info.name.toLowerCase().includes(q))
    .sort((a, b) => b[1].count - a[1].count);
  const maxCount = sorted[0]?.[1].count ?? 1;

  const filteredRecords = records.filter(r => !q || r.employee_name.toLowerCase().includes(q));

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl shimmer"/>)}</div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{error}</div>;

  const shirkingBlock = (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="font-bold text-slate-800">טבלת הברזות</h3>
        <p className="text-xs text-slate-400 mt-0.5">כמה פעמים כל עובד הבריז ממשמרת</p>
      </div>
      {sorted.length === 0
        ? <p className="text-center text-slate-400 text-sm py-10">אין הברזות רשומות</p>
        : (
          <div className="p-5 space-y-2.5">
            {sorted.map(([empId, info], rank) => (
              <div key={empId} className="flex items-center gap-3">
                <RankBadge rank={rank} />
                <div className="w-28 text-sm font-semibold text-slate-800 shrink-0 truncate">{info.name}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden min-w-[80px]">
                  <div className="h-6 rounded-full bg-rose-400 transition-all duration-500"
                    style={{ width: `${maxCount > 0 ? (info.count / maxCount) * 100 : 0}%`, minWidth: info.count > 0 ? "1.5rem" : "0" }}/>
                  <span className="absolute inset-y-0 right-2 flex items-center text-xs font-bold text-slate-700">{info.count}</span>
                </div>
                <div className="text-xs text-slate-400 shrink-0 w-20 text-left">{info.count} הברזות</div>
              </div>
            ))}
          </div>
        )
      }
      {/* Detail list */}
      {filteredRecords.length > 0 && (
        <div className="border-t border-slate-100">
          <div className="px-6 py-3 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500">פירוט הברזות</p>
          </div>
          <div className="divide-y divide-slate-50">
            {filteredRecords.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-6 py-2.5 hover:bg-slate-50 transition-all">
                <div className="flex-1">
                  <span className="text-sm font-semibold text-slate-800">{r.employee_name}</span>
                  <span className="text-xs text-slate-400 mx-1.5">—</span>
                  <span className="text-sm text-slate-600">{r.shift_name}</span>
                  <span className="text-xs text-slate-400 mx-1.5">יום {r.day}/{r.month}/{r.year}</span>
                  {r.replacement_name && <span className="text-xs text-slate-400">(הוחלף ע״י {r.replacement_name})</span>}
                </div>
                <button type="button" onClick={() => handleDelete(r.id)} className="text-slate-300 hover:text-red-400 transition-all shrink-0">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd"/></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Build combined balance per employee (volunteer_count − shirking_count)
  const balanceMap: Record<string, { name: string; volunteerCount: number; shirkingCount: number }> = {};
  if (volunteerData) {
    for (const e of volunteerData) {
      if (!q || e.employee_name.toLowerCase().includes(q)) {
        balanceMap[e.employee_id] ??= { name: e.employee_name, volunteerCount: 0, shirkingCount: 0 };
        balanceMap[e.employee_id].volunteerCount = e.volunteer_count;
      }
    }
  }
  for (const r of records) {
    if (!q || r.employee_name.toLowerCase().includes(q)) {
      balanceMap[r.employee_id] ??= { name: r.employee_name, volunteerCount: 0, shirkingCount: 0 };
      balanceMap[r.employee_id].shirkingCount = totals[r.employee_id]?.count ?? 0;
    }
  }
  const balanceSorted = Object.entries(balanceMap)
    .map(([id, v]) => ({ id, ...v, net: v.volunteerCount - v.shirkingCount }))
    .sort((a, b) => b.net - a.net);
  const maxAbsNet = Math.max(...balanceSorted.map(r => Math.abs(r.net)), 1);

  return (
    <div className="space-y-5">
      {/* Toggle button */}
      {volunteerData && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setSideBySide(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              sideBySide
                ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"/>
            </svg>
            {sideBySide ? "הסתר מאזן" : "הצג מאזן התנדבות − הברזות"}
          </button>
        </div>
      )}

      {/* Balance summary table */}
      {sideBySide && volunteerData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">מאזן התנדבות − הברזות</h3>
            <p className="text-xs text-slate-400 mt-0.5">התנדבויות מינוס הברזות = ניקוד נטו לכל עובד</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-semibold">
                  <th className="px-4 py-2.5 text-right w-8">#</th>
                  <th className="px-4 py-2.5 text-right">עובד</th>
                  <th className="px-4 py-2.5 text-center">🤝 התנדבויות</th>
                  <th className="px-4 py-2.5 text-center">🚫 הברזות</th>
                  <th className="px-4 py-2.5 text-center">מאזן</th>
                  <th className="px-4 py-2.5 text-right w-48">גרף</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {balanceSorted.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">אין נתונים</td></tr>
                )}
                {balanceSorted.map((row, i) => {
                  const barPct = maxAbsNet > 0 ? (Math.abs(row.net) / maxAbsNet) * 100 : 0;
                  const isPositive = row.net >= 0;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{row.name}</td>
                      <td className="px-4 py-3 text-center text-green-600 font-medium">{row.volunteerCount}</td>
                      <td className="px-4 py-3 text-center text-rose-500 font-medium">{row.shirkingCount}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-base ${isPositive ? "text-green-600" : "text-rose-500"}`}>
                          {row.net > 0 ? "+" : ""}{row.net}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center h-5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-5 rounded-full transition-all duration-500 ${isPositive ? "bg-green-400" : "bg-rose-400"}`}
                            style={{ width: `${barPct}%`, minWidth: row.net !== 0 ? "1rem" : "0" }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full shirking table — always visible */}
      {shirkingBlock}
    </div>
  );
}

// ── Day Type Justice section ──────────────────────────────────────────────────
function DayTypeJusticeSection({
  data, view, onViewChange, search, onEmployeeClick,
}: {
  data: DayTypeJusticeData;
  view: "total" | "breakdown";
  onViewChange: (v: "total" | "breakdown") => void;
  search: string;
  onEmployeeClick?: (name: string) => void;
}) {
  const q = search.trim();
  const employees = data.employees.filter(e => !q || e.name.includes(q));
  const maxTotal = Math.max(...employees.map(e => e.total_score), 1);

  // Which day types actually have any counts in this data
  const activeDayTypes = data.day_types.filter(dt =>
    employees.some(e => e.by_type[dt.id]?.count > 0)
  );
  const hasShabbat = employees.some(e => e.shabbat_count > 0);

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-2">
        <button type="button" onClick={() => onViewChange("total")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${view === "total" ? "bg-purple-600 text-white border-purple-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
          ציון כולל
        </button>
        <button type="button" onClick={() => onViewChange("breakdown")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${view === "breakdown" ? "bg-purple-600 text-white border-purple-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
          פירוט לכל סוג
        </button>
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 text-slate-400 text-sm">
          אין נתוני שבתות / חגים בטווח הנבחר
        </div>
      ) : view === "total" ? (
        /* Total score view */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-slate-800">ציון שבתות וחגים — סה״כ</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                שישי: {data.weekday_scores?.["4"] ?? 0} נק׳ · שבת: {data.weekday_scores?.["5"] ?? 0} נק׳ · ציון חג לפי הגדרה
              </p>
            </div>
          </div>
          <div className="p-5 space-y-2.5">
            {employees.map((e, rank) => (
              <div
                key={e.name}
                className={`flex items-center gap-3 rounded-xl px-2 py-1 -mx-2 transition-colors ${onEmployeeClick ? "cursor-pointer hover:bg-purple-50" : ""}`}
                onClick={() => onEmployeeClick?.(e.name)}
                title={onEmployeeClick ? "לחץ לפירוט" : undefined}
              >
                <RankBadge rank={rank} />
                <div className="w-28 text-sm font-semibold text-slate-800 shrink-0 truncate">{e.name}</div>
                <Bar value={e.total_score} max={maxTotal}
                  color={rank === 0 ? "bg-purple-500" : rank === 1 ? "bg-purple-300" : "bg-purple-200"} />
                <div className="text-xs text-slate-400 shrink-0 w-20 text-left">{e.total_score} נק׳</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Breakdown view */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">פירוט שבתות וחגים לעובד</h3>
            <span className="text-xs bg-purple-100 text-purple-600 px-3 py-1 rounded-full font-medium">גבוה / נמוך</span>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: "520px", overflowY: "auto" }}>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap sticky top-0 bg-slate-50 z-10">#</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap sticky top-0 bg-slate-50 z-10">עובד</th>
                  {hasShabbat && (
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap sticky top-0 bg-slate-50 z-10">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
                        שישי/שבת (ו׳:{data.weekday_scores?.["4"] ?? 0} ש׳:{data.weekday_scores?.["5"] ?? 0} נק׳)
                      </span>
                    </th>
                  )}
                  {activeDayTypes.map(dt => (
                    <th key={dt.id} className="px-3 py-3 text-center font-semibold whitespace-nowrap sticky top-0 bg-slate-50 z-10">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${dt.color}`}>{dt.name} ({dt.score} נק׳)</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap sticky top-0 bg-slate-50 z-10">סה״כ נק׳</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((row, idx) => {
                  // column stats for highlighting
                  const shabbatVals = employees.map(e => e.shabbat_count);
                  const shabbatMin = Math.min(...shabbatVals);
                  const shabbatMax = Math.max(...shabbatVals);
                  const totalVals = employees.map(e => e.total_score);
                  const totalMin = Math.min(...totalVals);
                  const totalMax = Math.max(...totalVals);
                  return (
                    <tr
                      key={row.name}
                      className={`border-b border-slate-50 hover:bg-purple-50/20 ${idx % 2 === 0 ? "" : "bg-slate-50/40"} ${onEmployeeClick ? "cursor-pointer" : ""}`}
                      onClick={() => onEmployeeClick?.(row.name)}
                    >
                      <td className="px-4 py-3 text-slate-400 text-xs font-medium">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{row.name}</td>
                      {hasShabbat && (() => {
                        const isHigh = row.shabbat_count === shabbatMax && shabbatMin !== shabbatMax;
                        const isLow = row.shabbat_count === shabbatMin && shabbatMin !== shabbatMax;
                        return (
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex flex-col items-center justify-center w-12 h-10 rounded-lg text-xs font-bold ${isHigh ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300" : isLow ? "bg-red-100 text-red-600 ring-2 ring-red-200" : "text-slate-600"}`}>
                              <span>{row.shabbat_count}</span>
                              <span className="text-[10px] font-normal opacity-70">{row.shabbat_score} נק׳</span>
                            </span>
                          </td>
                        );
                      })()}
                      {activeDayTypes.map(dt => {
                        const entry = row.by_type[dt.id];
                        const count = entry?.count ?? 0;
                        const score = entry?.score ?? 0;
                        const vals = employees.map(e => e.by_type[dt.id]?.count ?? 0);
                        const min = Math.min(...vals); const max = Math.max(...vals);
                        const isHigh = count === max && min !== max;
                        const isLow = count === min && min !== max;
                        return (
                          <td key={dt.id} className="px-3 py-3 text-center">
                            <span className={`inline-flex flex-col items-center justify-center w-12 h-10 rounded-lg text-xs font-bold ${isHigh ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300" : isLow ? "bg-red-100 text-red-600 ring-2 ring-red-200" : "text-slate-600"}`}>
                              <span>{count}</span>
                              <span className="text-[10px] font-normal opacity-70">{score} נק׳</span>
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-sm font-bold ${row.total_score === totalMax && totalMin !== totalMax ? "text-purple-600" : row.total_score === totalMin && totalMin !== totalMax ? "text-red-500" : "text-slate-700"}`}>
                            {row.total_score}
                          </span>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-400 rounded-full" style={{ width: `${(row.total_score / maxTotal) * 100}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function JusticePage() {
  const [data, setData] = useState<JusticeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("justice");
  const [view, setView] = useState<View>("table");
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [rangeType, setRangeType] = useState<RangeType>("month");
  const [refDate, setRefDate] = useState<Date>(() => new Date());

  const { start, end } = getRangeBounds(rangeType, refDate);
  const startISO = toISO(start);
  const endISO = toISO(end);
  const rangeLabel = formatRange(rangeType, start, end);

  useEffect(() => {
    getEmployees().then(setEmployees).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getJustice(startISO, endISO)
      .then(setData)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [startISO, endISO]);

  useEffect(() => {
    if (tab !== "daytype") return;
    setDaytypeLoading(true);
    setDaytypeError(null);
    getDayTypeJustice(startISO, endISO)
      .then(setDaytypeData)
      .catch(e => setDaytypeError((e as Error).message))
      .finally(() => setDaytypeLoading(false));
  }, [tab, startISO, endISO]);

  const [search, setSearch] = useState("");
  const [daytypeData, setDaytypeData] = useState<DayTypeJusticeData | null>(null);
  const [daytypeLoading, setDaytypeLoading] = useState(false);
  const [daytypeError, setDaytypeError] = useState<string | null>(null);
  const [daytypeView, setDaytypeView] = useState<"total" | "breakdown">("total");

  const [showDayScores, setShowDayScores] = useState(false);
  const [dayScoreData, setDayScoreData] = useState<DayTypeJusticeData | null>(null);
  const [breakdownEmployee, setBreakdownEmployee] = useState<string | null>(null);
  const [volunteerBreakdownEmployee, setVolunteerBreakdownEmployee] = useState<string | null>(null);
  const [daytypeBreakdownEmployee, setDaytypeBreakdownEmployee] = useState<string | null>(null);

  useEffect(() => {
    if (!showDayScores) return;
    getDayTypeJustice(startISO, endISO)
      .then(setDayScoreData)
      .catch(() => setDayScoreData(null));
  }, [showDayScores, startISO, endISO]);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "justice",   label: "טבלת צדק",         icon: "⚖️" },
    { id: "volunteer", label: "טבלת התנדבות",     icon: "🤝" },
    { id: "combined",  label: "שניהם",             icon: "📊" },
    { id: "shirking",  label: "הברזות",            icon: "🚫" },
    { id: "advocates", label: "סנגורים",           icon: "🏆" },
    { id: "daytype",   label: "שבתות וחגים",       icon: "🕍" },
  ];

  const rangeTypes: { id: RangeType; label: string }[] = [
    { id: "week",  label: "שבוע" },
    { id: "month", label: "חודש" },
    { id: "year",  label: "שנה" },
  ];

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">טבלאות ניקוד</h1>
        <p className="text-slate-500 mt-1 text-sm">
          טבלת צדק — מי עשה הכי הרבה משמרות לא רצויות | טבלת התנדבות — מי התנדב הכי הרבה
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-xs w-full">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם עובד..."
          className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-slate-400"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/></svg>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Tab selector */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* View toggle — hidden on advocates/shirking/daytype tabs */}
        <div className={`flex gap-1 bg-slate-100 rounded-xl p-1 ${(tab === "advocates" || tab === "shirking" || tab === "daytype") ? "invisible" : ""}`}>
          <button type="button" onClick={() => setView("table")}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              view === "table" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M.99 5.24A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25l.01 9.5A2.25 2.25 0 0 1 16.76 17H3.26A2.272 2.272 0 0 1 1 14.76l-.01-9.5Zm8.26 9.52v-.625a.75.75 0 0 0-.75-.75H3.25a.75.75 0 0 0-.75.75v.615c0 .414.336.75.75.75h5.09a.75.75 0 0 0 .91-.74Zm1.5 0a.75.75 0 0 0 .91.74h5.09a.75.75 0 0 0 .75-.75v-.615a.75.75 0 0 0-.75-.75H11.5a.75.75 0 0 0-.75.75v.625Zm6.75-3.63v-.625a.75.75 0 0 0-.75-.75H11.5a.75.75 0 0 0-.75.75v.625c0 .414.336.75.75.75h5.25a.75.75 0 0 0 .75-.75Zm-8.25 0v-.625a.75.75 0 0 0-.75-.75H3.25a.75.75 0 0 0-.75.75v.625c0 .414.336.75.75.75H8.5a.75.75 0 0 0 .75-.75Z" clipRule="evenodd"/>
            </svg>
            טבלה
          </button>
          <button type="button" onClick={() => setView("chart")}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              view === "chart" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2ZM9.5 7A1.5 1.5 0 0 0 8 8.5v8a1.5 1.5 0 0 0 3 0v-8A1.5 1.5 0 0 0 9.5 7ZM3.5 12A1.5 1.5 0 0 0 2 13.5v3a1.5 1.5 0 0 0 3 0v-3A1.5 1.5 0 0 0 3.5 12Z"/>
            </svg>
            גרף
          </button>
        </div>
      </div>

      {/* Day scores toggle — visible on justice/volunteer/combined tabs */}
      {(tab === "justice" || tab === "volunteer" || tab === "combined") && (
        <button
          type="button"
          onClick={() => { setShowDayScores(v => !v); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
            showDayScores
              ? "bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          🕍 {showDayScores ? "מסתיר ניקוד שבת/חגים" : "הוסף ניקוד שבת/חגים"}
        </button>
      )}

      {/* Time range bar — hidden on advocates/shirking tabs */}
      <div className={`flex items-center gap-3 flex-wrap ${(tab === "advocates" || tab === "shirking") ? "hidden" : ""}`}>
        {/* Range type buttons */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {rangeTypes.map(r => (
            <button key={r.id} type="button"
              onClick={() => { setRangeType(r.id); setRefDate(new Date()); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                rangeType === r.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Prev / label / next */}
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => setRefDate(shiftRef(rangeType, refDate, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
            title="קודם"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 0 1 0-1.414L10.586 10 7.293 6.707a1 1 0 0 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0Z" clipRule="evenodd"/></svg>
          </button>
          <span className="text-sm font-semibold text-slate-700 min-w-[160px] text-center">{rangeLabel}</span>
          <button type="button"
            onClick={() => setRefDate(shiftRef(rangeType, refDate, -1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
            title="הבא"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 0 1 0 1.414L9.414 10l3.293 3.293a1 1 0 0 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 0Z" clipRule="evenodd"/></svg>
          </button>
          <button type="button"
            onClick={() => setRefDate(new Date())}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
          >
            היום
          </button>
        </div>
      </div>

      {/* Error */}
      {tab !== "advocates" && tab !== "shirking" && tab !== "daytype" && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Loading */}
      {tab !== "advocates" && tab !== "shirking" && tab !== "daytype" && loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-2xl shimmer" />)}
        </div>
      )}

      {/* Advocates tab — independent of justice loading */}
      {tab === "advocates" && <AdvocatesSection employees={employees} search={search} />}

      {/* Shirking tab — independent of justice loading */}
      {tab === "shirking" && <ShirkingSection search={search} volunteerData={data} />}

      {/* Daytype tab */}
      {tab === "daytype" && (
        daytypeLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl shimmer"/>)}</div>
        ) : daytypeError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{daytypeError}</div>
        ) : daytypeData ? (
          <DayTypeJusticeSection data={daytypeData} view={daytypeView} onViewChange={setDaytypeView} search={search} onEmployeeClick={setDaytypeBreakdownEmployee} />
        ) : null
      )}

      {/* Breakdown modal */}
      {breakdownEmployee && (
        <BreakdownModal
          employee={breakdownEmployee}
          startDate={startISO}
          endDate={endISO}
          onClose={() => setBreakdownEmployee(null)}
        />
      )}
      {volunteerBreakdownEmployee && (
        <VolunteerBreakdownModal
          employee={volunteerBreakdownEmployee}
          startDate={startISO}
          endDate={endISO}
          onClose={() => setVolunteerBreakdownEmployee(null)}
        />
      )}
      {daytypeBreakdownEmployee && (
        <DayTypeBreakdownModal
          employee={daytypeBreakdownEmployee}
          startDate={startISO}
          endDate={endISO}
          onClose={() => setDaytypeBreakdownEmployee(null)}
        />
      )}

      {/* Content for justice/volunteer/combined */}
      {tab !== "advocates" && tab !== "shirking" && tab !== "daytype" && !loading && !error && (
        <div className="space-y-6">
          {(() => {
            const getDayScoreForEmployee = (name: string) => {
              if (!showDayScores || !dayScoreData) return 0;
              return dayScoreData.employees.find(e => e.name === name)?.total_score ?? 0;
            };
            return (
              <>
                {tab === "justice" && (
                  <JusticeSection
                    data={data}
                    view={view}
                    search={search}
                    getDayScore={showDayScores ? getDayScoreForEmployee : undefined}
                    onEmployeeClick={view === "table" ? setBreakdownEmployee : undefined}
                  />
                )}
                {tab === "volunteer" && (
                  <VolunteerSection
                    data={data}
                    view={view}
                    search={search}
                    getDayScore={showDayScores ? getDayScoreForEmployee : undefined}
                    onEmployeeClick={view === "table" ? setVolunteerBreakdownEmployee : undefined}
                  />
                )}
                {tab === "combined" && (
                  view === "chart"
                    ? <CombinedChart data={data} search={search} />
                    : <CombinedTable data={data} search={search} />
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
