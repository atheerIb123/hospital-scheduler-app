"use client";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { getJustice, getAdvocates, addAdvocate, removeAdvocate, getEmployees, getShirking, removeShirking, getDayTypeJustice, getJusticeBreakdown, getVolunteerBreakdown, getDayTypeBreakdown, getVolunteers, getManualPoints, addManualPoint, removeManualPoint, getOncallJustice, getOncallJusticeBreakdown, getOncallAllAssignments, type JusticeEntry, type Advocate, type ShirkingRecord, type DayTypeJusticeData, type JusticeBreakdown, type VolunteerBreakdown, type DayTypeBreakdown, type Volunteer, type ManualPoint, type ManualPointTable, type OncallJusticeEntry, type OncallBreakdown, type OncallBreakdownRow } from "@/lib/api";
import type { Employee } from "@/lib/types";
import { Button, DeleteIconButton, Alert, Input, Select, TabButton, TabsContainer, SearchInput, SearchDropdown, Toggle, DateRangePicker, FilterPill } from "@/components/ui";
import type { DateRangeValue } from "@/components/ui";
import { X, Plus, Check, Handshake, Ban, ChevronDown, Trash2, Scale, Building2, Trophy, BarChart2, Pencil, PhoneCall } from "lucide-react";
import type { ReactNode } from "react";
import { useMode } from "@/components/ModeProvider";

type Tab = "justice" | "volunteer" | "combined" | "advocates" | "shirking" | "daytype" | "manual" | "oncall";
type View = "table" | "chart";
type DayTypeFilter = "combined" | "shabbat" | "holidays";

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

function Bar({ value, max, color, children }: { value: number; max: number; color: string; children?: React.ReactNode }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden min-w-[80px]">
      <div className={`h-6 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%`, minWidth: value > 0 ? "1.5rem" : "0" }} />
      <span className="absolute inset-y-0 right-2 flex items-center text-xs font-bold text-slate-700 gap-1">
        {children ?? value}
      </span>
    </div>
  );
}

// ── Manual points +/− popover ─────────────────────────────────────────────────
function PointsButton({ employeeId, employeeName, manualTotal, table, onAdd }: {
  employeeId: string;
  employeeName: string;
  manualTotal: number;
  table: ManualPointTable;
  onAdd: (employeeId: string, employeeName: string, points: number, reason: string, table: ManualPointTable, date?: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState(1);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const openPopover = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setStyle({ position: "fixed", top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen(true);
  };

  const submit = async (sign: 1 | -1) => {
    if (!points) return;
    setSaving(true);
    try {
      await onAdd(employeeId, employeeName, sign * Math.abs(points), reason, table, new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }));
      setReason("");
      setPoints(1);
      setOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={openPopover}
        title="הוסף / הורד נקודות"
        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border transition-all
          ${manualTotal > 0 ? "bg-emerald-50 border-emerald-300 text-emerald-700" :
            manualTotal < 0 ? "bg-rose-50 border-rose-300 text-rose-600" :
            "bg-slate-50 border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-600"}`}
      >
        {manualTotal !== 0 && <span>{manualTotal > 0 ? "+" : ""}{manualTotal}</span>}
        <Plus className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div style={style} className="z-[9999] bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-52" dir="rtl">
            <p className="text-xs font-bold text-slate-500 mb-2">ניקוד ידני — {employeeName}</p>
            <div className="flex items-center gap-1.5 mb-2">
              <button type="button" onClick={() => setPoints(p => Math.max(1, p - 1))}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 flex items-center justify-center text-base transition-colors">−</button>
              <input
                type="number" min={1} value={points}
                onChange={e => setPoints(Math.max(1, Number(e.target.value)))}
                onClick={e => e.stopPropagation()}
                className="flex-1 text-center text-sm font-bold border border-slate-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
              <button type="button" onClick={() => setPoints(p => p + 1)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 flex items-center justify-center text-base transition-colors">+</button>
            </div>
            <input
              type="text" value={reason} onChange={e => setReason(e.target.value)}
              placeholder="סיבה (אופציונלי)"
              onClick={e => e.stopPropagation()}
              onKeyDown={e => e.stopPropagation()}
              className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            <div className="flex gap-1.5">
              <button type="button" disabled={saving} onClick={() => submit(1)}
                className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50">
                +{points} הוסף
              </button>
              <button type="button" disabled={saving} onClick={() => submit(-1)}
                className="flex-1 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50">
                −{points} הורד
              </button>
            </div>
          </div>
        </>
      )}
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

function BreakdownModal({ employee, employeeId, manualPoints, startDate, endDate, onClose, filter = "combined" }: {
  employee: string;
  employeeId?: string;
  manualPoints?: ManualPoint[];
  startDate?: string;
  endDate?: string;
  onClose: () => void;
  filter?: DayTypeFilter;
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

  // Calculate manual points for this employee (filter by ID if available)
  const relevantManual = (manualPoints ?? []).filter(p => p.employee_id === employeeId);
  const manualSum = relevantManual.reduce((sum, p) => sum + p.points, 0);
  const displayTotal = (data?.total ?? 0) + manualSum;

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
          {!loading && (
            <div className="text-2xl font-bold text-blue-600 ml-4">{displayTotal} נק׳</div>
          )}
          <button onClick={onClose} className="ml-3 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">טוען...</div>
          ) : (!data || data.rows.length === 0) && relevantManual.length === 0 ? (
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
                {data?.rows.map((row, i) => (
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
                {relevantManual.map((mp) => (
                  <tr key={mp.id} className="bg-amber-50/40 border-b border-amber-100 hover:bg-amber-50">
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap tabular-nums">
                      {new Date(mp.created_at).toLocaleDateString("he-IL")}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">-</td>
                    <td className="px-4 py-2.5 text-slate-700 font-medium">{mp.reason || "ניקוד ידני"}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-400">-</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-blue-600" dir="ltr">{mp.points > 0 ? `+${mp.points}` : mp.points}</td>
                    <td className="px-4 py-2.5 text-center">-</td>
                    <td className="px-4 py-2.5 text-center font-bold text-slate-800" dir="ltr">{mp.points > 0 ? `+${mp.points}` : mp.points}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white border-t-2 border-slate-200">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right font-bold text-slate-700">סה״כ</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-600 text-base">{displayTotal}</td>
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
function VolunteerBreakdownModal({ employee, employeeId, manualPoints, startDate, endDate, onClose }: {
  employee: string;
  employeeId?: string;
  manualPoints?: ManualPoint[];
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

  // Calculate manual points
  const relevantManual = (manualPoints ?? []).filter(p => p.employee_id === employeeId);
  const manualSum = relevantManual.reduce((sum, p) => sum + p.points, 0);
  const displayTotal = (data?.total ?? 0) + manualSum;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">{employee}</h2>
            <p className="text-xs text-slate-400 mt-0.5">פירוט חישוב ניקוד התנדבות</p>
          </div>
          {!loading && <div className="text-2xl font-bold text-green-600 ml-4">{displayTotal} נק׳</div>}
          <button onClick={onClose} className="ml-3 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">טוען...</div>
          ) : (!data || data.rows.length === 0) && relevantManual.length === 0 ? (
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
                {data?.rows.map((row, i) => (
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
                {relevantManual.map((mp) => (
                  <tr key={mp.id} className="bg-amber-50/40 border-b border-amber-100 hover:bg-amber-50">
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap tabular-nums">
                      {new Date(mp.created_at).toLocaleDateString("he-IL")}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">-</td>
                    <td className="px-4 py-2.5 text-slate-700 font-medium">{mp.reason || "ניקוד ידני"}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-400">-</td>
                    <td className="px-4 py-2.5 text-center font-bold text-green-600" dir="ltr">{mp.points > 0 ? `+${mp.points}` : mp.points}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white border-t-2 border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-bold text-slate-700">סה״כ</td>
                  <td className="px-4 py-3 text-center font-bold text-green-600 text-base">{displayTotal}</td>
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
function DayTypeBreakdownModal({ employee, employeeId, manualPoints, startDate, endDate, onClose, filter }: {
  employee: string;
  employeeId?: string;
  manualPoints?: ManualPoint[];
  startDate?: string;
  endDate?: string;
  onClose: () => void;
  filter: DayTypeFilter;
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

  // Filter rows based on view
  const rows = data?.rows.filter(r => {
    if (filter === "shabbat") return r.is_shabbat;
    if (filter === "holidays") return !r.is_shabbat && r.day_type; // Show only non-shabbat day types (holidays)
    return true; // combined
  }) ?? [];

  // Calculate manual points
  // Manual points are only part of the "combined" score in the main table logic, so we hide them in filtered views to match.
  const relevantManual = filter === "combined" ? (manualPoints ?? []).filter(p => p.employee_id === employeeId) : [];
  const manualSum = relevantManual.reduce((sum, p) => sum + p.points, 0);
  
  const rowsTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const displayTotal = rowsTotal + manualSum;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">{employee}</h2>
            <p className="text-xs text-slate-400 mt-0.5">פירוט חישוב ניקוד שבתות וחגים</p>
          </div>
          {!loading && (
            <div className="flex flex-col items-end ml-4">
              <div className="text-2xl font-bold text-purple-600">{displayTotal} נק׳</div>
              {filter !== "combined" && <span className="text-[10px] text-slate-400">({filter === "shabbat" ? "שבתות בלבד" : "חגים בלבד"})</span>}
            </div>
          )}
          <button onClick={onClose} className="ml-3 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">טוען...</div>
          ) : rows.length === 0 && relevantManual.length === 0 ? (
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
                {rows.map((row, i) => (
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
                {relevantManual.map((mp) => (
                  <tr key={mp.id} className="bg-amber-50/40 border-b border-amber-100 hover:bg-amber-50">
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap tabular-nums">
                      {new Date(mp.created_at).toLocaleDateString("he-IL")}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">-</td>
                    <td className="px-4 py-2.5 text-slate-700 font-medium">{mp.reason || "ניקוד ידני"}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-400">-</td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-400">-</td>
                    <td className="px-4 py-2.5 text-center font-bold text-purple-700" dir="ltr">{mp.points > 0 ? `+${mp.points}` : mp.points}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white border-t-2 border-slate-200">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">סה״כ</td>
                  <td className="px-4 py-3 text-center font-bold text-purple-600 text-base">{displayTotal}</td>
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
function JusticeSection({ data, view, search, getDayScore, onEmployeeClick, manualTotals = {} }: { data: JusticeEntry[]; view: View; search: string; getDayScore?: (name: string) => number; onEmployeeClick?: (id: string, name: string) => void; manualTotals?: Record<string, number>; }) {
  const q = search.trim().toLowerCase();
  const sorted = [...data]
    .filter(e => !q || e.employee_name.toLowerCase().includes(q))
    .sort((a, b) => {
      // Use fallback if employee_id is missing/mismatch
      const manualA = manualTotals[a.employee_id] ?? 0;
      const manualB = manualTotals[b.employee_id] ?? 0;
      const scoreA = a.justice_score + manualA;
      const scoreB = b.justice_score + manualB;
      return scoreB - scoreA;
    });
  const max = sorted.length > 0 ? sorted[0].justice_score + (manualTotals[sorted[0].employee_id] ?? 0) : 1;

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
            onClick={() => onEmployeeClick?.(e.employee_id, e.employee_name)}
            title={onEmployeeClick ? "לחץ לפירוט" : undefined}
          >
            {(() => {
              const manual = manualTotals[e.employee_id] ?? 0;
              const totalScore = e.justice_score + manual;
              return (
                <>
            <RankBadge rank={rank} />
            <div className="w-28 text-sm font-semibold text-slate-800 shrink-0 truncate">{e.employee_name}</div>
            <Bar value={totalScore} max={max} color={rank === 0 ? "bg-amber-400" : rank === 1 ? "bg-slate-300" : rank === 2 ? "bg-orange-300" : "bg-blue-400"}>
              {totalScore}
            </Bar>
            <div className="text-xs text-slate-400 shrink-0 w-20 text-left">{e.justice_shifts} משמרות</div>
            {getDayScore && (
              <div className="text-sm font-bold text-purple-600 shrink-0 w-16 text-center" title="ניקוד שבת/חגים">
                <span className="inline-flex items-center gap-1">{getDayScore(e.employee_name)}<Building2 className="w-3.5 h-3.5" /></span>
              </div>
            )}
            {getDayScore && (
              <div className="text-sm font-bold text-slate-800 shrink-0 w-16 text-center" title="סה״כ">
                {totalScore + getDayScore(e.employee_name)}
              </div>
            )}
                </>
              );
            })()}
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
function VolunteerSection({ data, view, search, onEmployeeClick, manualTotals = {} }: { data: JusticeEntry[]; view: View; search: string; onEmployeeClick?: (id: string, name: string) => void; manualTotals?: Record<string, number>; }) {
  const [records, setRecords] = useState<Volunteer[]>([]);
  const [shiftSearch, setShiftSearch] = useState("");

  useEffect(() => {
    getVolunteers().then(setRecords).catch(() => {});
  }, []);

  const q = search.trim().toLowerCase();
  const sq = shiftSearch.trim().toLowerCase();

  // When shift filter active, derive sorted list from raw records
  const shiftFiltered = sq ? records.filter(r => r.shift_name.toLowerCase().includes(sq)) : null;

  const sorted = shiftFiltered
    ? (() => {
        const totals: Record<string, { employee_id: string; employee_name: string; volunteer_count: number; volunteer_score: number }> = {};
        for (const r of shiftFiltered) {
          if (q && !r.employee_name.toLowerCase().includes(q)) continue;
          totals[r.employee_id] ??= { employee_id: r.employee_id, employee_name: r.employee_name, volunteer_count: 0, volunteer_score: 0 };
          totals[r.employee_id].volunteer_count++;
        }
        return Object.values(totals).sort((a, b) => b.volunteer_count - a.volunteer_count);
      })()
    : [...data]
        .filter(e => !q || e.employee_name.toLowerCase().includes(q))
        .sort((a, b) => {
          const scoreA = a.volunteer_score + (manualTotals[a.employee_id] ?? 0);
          const scoreB = b.volunteer_score + (manualTotals[b.employee_id] ?? 0);
          return scoreB - scoreA;
        });

  const max = shiftFiltered
    ? (sorted[0]?.volunteer_count ?? 1)
    : (sorted.length > 0 ? sorted[0].volunteer_score + (manualTotals[sorted[0].employee_id] ?? 0) : 1);

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
              const val = shiftFiltered ? e.volunteer_count : (e as JusticeEntry).volunteer_score;
              const barH = max > 0 ? Math.max(val > 0 ? 4 : 0, Math.round((val / max) * 150)) : 0;
              return (
                <div key={e.employee_id} className="flex flex-col items-center gap-1 min-w-[52px]">
                  <span className="text-xs font-bold text-slate-600">{val}</span>
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
    <div className="space-y-5">
      {/* Shift filter */}
      <SearchInput
        value={shiftSearch}
        onChange={setShiftSearch}
        placeholder="חיפוש לפי משמרת..."
        className="max-w-xs"
      />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">טבלת התנדבות</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {shiftFiltered ? `סינון לפי משמרת: ${shiftSearch}` : "ניקוד לפי כמות ואיכות ההתנדבויות — ממשמרת לא רצויה מקבלים יותר נקודות"}
          </p>
        </div>
        <div className="p-5 space-y-2.5">
          {sorted.map((e, rank) => {
            const manual = manualTotals[e.employee_id] ?? 0;
            const displayValue = shiftFiltered ? e.volunteer_count : (e as JusticeEntry).volunteer_score + manual;
            return (
              <div
                key={e.employee_id}
                className={`flex items-center gap-3 rounded-xl px-2 py-1 -mx-2 transition-colors ${onEmployeeClick && !shiftFiltered ? "cursor-pointer hover:bg-green-50" : ""}`}
                onClick={() => !shiftFiltered && onEmployeeClick?.(e.employee_id, e.employee_name)}
                title={onEmployeeClick && !shiftFiltered ? "לחץ לפירוט" : undefined}
              >
                <RankBadge rank={rank} />
                <div className="w-28 text-sm font-semibold text-slate-800 shrink-0 truncate">{e.employee_name}</div>
                <Bar value={displayValue} max={max} color={rank === 0 ? "bg-green-500" : rank === 1 ? "bg-green-300" : "bg-green-200"}>
                  {displayValue}
                </Bar>
                <div className="text-xs text-slate-400 shrink-0 w-24 text-left">{e.volunteer_count} התנדבויות</div>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">אין נתוני התנדבויות עדיין</p>
          )}
        </div>
      </div>

      {/* Detail list when shift filter active */}
      {shiftFiltered && shiftFiltered.filter(r => !q || r.employee_name.toLowerCase().includes(q)).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500">פירוט התנדבויות</p>
          </div>
          <div className="divide-y divide-slate-50">
            {shiftFiltered
              .filter(r => !q || r.employee_name.toLowerCase().includes(q))
              .map(r => (
                <div key={r.id} className="flex items-center gap-3 px-6 py-2.5 hover:bg-slate-50 transition-all">
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-slate-800">{r.employee_name}</span>
                    <span className="text-xs text-slate-400 mx-1.5">—</span>
                    <span className="text-sm text-slate-600">{r.shift_name}</span>
                    <span className="text-xs text-slate-400 mx-1.5">יום {r.day}/{r.month}/{r.year}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Oncall Breakdown Modal ────────────────────────────────────────────────────

const SLOT_COLORS: Record<string, string> = {
  "ערב_1": "bg-amber-100 text-amber-700 border-amber-200",
  "ערב_2": "bg-orange-100 text-orange-700 border-orange-200",
  "לילה":  "bg-indigo-100 text-indigo-700 border-indigo-200",
};

function OncallBreakdownModal({ employeeId, employeeName, manualPoints, startDate, endDate, onClose }: {
  employeeId: string;
  employeeName: string;
  manualPoints: ManualPoint[];
  startDate?: string;
  endDate?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<OncallBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOncallJusticeBreakdown(employeeId, startDate, endDate)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [employeeId, startDate, endDate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const relevantManual = manualPoints.filter(p => p.employee_id === employeeId);
  const manualSum = relevantManual.reduce((sum, p) => sum + p.points, 0);
  const displayTotal = (data?.total ?? 0) + manualSum;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">{employeeName}</h2>
            <p className="text-xs text-slate-400 mt-0.5">פירוט כוננויות</p>
          </div>
          {!loading && (
            <div className="flex items-center gap-3 mr-auto ml-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{data?.total ?? 0}</div>
                <div className="text-[10px] text-slate-400">כוננויות</div>
              </div>
              {manualSum !== 0 && (
                <div className="text-center">
                  <div className={`text-lg font-bold ${manualSum > 0 ? "text-blue-600" : "text-rose-600"}`}>
                    {manualSum > 0 ? `+${manualSum}` : manualSum}
                  </div>
                  <div className="text-[10px] text-slate-400">ניקוד ידני</div>
                </div>
              )}
              {manualSum !== 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-800">{displayTotal}</div>
                  <div className="text-[10px] text-slate-400">סה״כ</div>
                </div>
              )}
            </div>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors mr-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">טוען...</div>
          ) : (
            <>
              {(!data || data.rows.length === 0) && relevantManual.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">אין נתוני כוננות בטווח הנבחר</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                    <tr>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">תאריך</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">יום</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">סוג כוננות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.rows.map((row, i) => (
                      <tr key={i} className={`border-b border-slate-50 hover:bg-orange-50/30 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                        <td className="px-4 py-2.5 text-slate-600 tabular-nums">{row.date}</td>
                        <td className="px-4 py-2.5 text-slate-700 font-medium">{row.day_of_week}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${SLOT_COLORS[row.slot] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {row.slot_label}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {relevantManual.map((mp, i) => (
                      <tr key={`manual-${i}`} className="border-b border-slate-50 bg-blue-50/40 hover:bg-blue-50">
                        <td className="px-4 py-2.5 text-slate-600 tabular-nums">{(mp.date || mp.created_at).slice(0, 10)}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">ניקוד ידני</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-semibold text-blue-600">
                            {mp.points > 0 ? `+${mp.points}` : mp.points} {mp.reason ? `— ${mp.reason}` : ""}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── All-in-one Combined table ─────────────────────────────────────────────────

type AllCombinedEntry = {
  empId: string;
  name: string;
  scores: {
    justice: number;
    volunteer: number;
    daytype: number;
    advocates: number;
    shirking: number;
    oncall: number;
  };
  total: number;
  manual: number;
};

const SCORE_COLS: { key: keyof AllCombinedEntry['scores']; label: string; color: string }[] = [
  { key: "justice",   label: "צדק",        color: "bg-blue-400" },
  { key: "volunteer", label: "התנדבות",    color: "bg-green-400" },
  { key: "daytype",   label: "שבת/חג",     color: "bg-purple-400" },
  { key: "oncall",    label: "כוננות",     color: "bg-orange-400" },
  { key: "advocates", label: "סנגורים",     color: "bg-fuchsia-400" },
  { key: "shirking",  label: "הברזות",     color: "bg-rose-400" },
];

function AllCombinedTable({ data, search }: {
  data: AllCombinedEntry[];
  search: string;
}) {
  const q = search.trim().toLowerCase();
  const filtered = data.filter(e => !q || e.name.toLowerCase().includes(q));

  // Find max absolute value for each column for bar scaling
  const maxScores: Record<string, number> = {};
  SCORE_COLS.forEach(col => {
    maxScores[col.key] = Math.max(...filtered.map(e => Math.abs(e.scores[col.key])), 1);
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="font-bold text-slate-800">טבלה משולבת כללית</h3>
        <p className="text-xs text-slate-400 mt-0.5">ממוין לפי סה״כ נקודות משוקלל מכל הטבלאות</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 font-semibold text-slate-500 w-10 text-center">#</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">עובד</th>
              {SCORE_COLS.map(col => (
                <th key={col.key} className="px-4 py-3 font-semibold text-slate-600 text-center">{col.label}</th>
              ))}
              <th className="px-4 py-3 font-semibold text-slate-700 text-center">סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, rank) => {
              return (
                <tr key={e.empId} className={`border-b border-slate-50 hover:bg-slate-50 ${rank % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                  <td className="px-4 py-3 text-center"><RankBadge rank={rank} /></td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{e.name}</td>
                  {SCORE_COLS.map(col => {
                    const value = e.scores[col.key];
                    const max = maxScores[col.key];
                    const pct = max > 0 ? (Math.abs(value) / max) * 100 : 0;
                    return (
                      <td key={col.key} className="px-4 py-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                            <div className={`h-4 rounded-full ${col.color}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-600 w-8 text-left">{value}</span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-bold text-slate-800">{e.total}</span>
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
function AdvocatesSection({ employees, search, manualTotals = {}, deptEmployeeIds }: { employees: Employee[]; search: string; manualTotals?: Record<string, number>; deptEmployeeIds?: Set<string>; }) {
  const [advocates, setAdvocates] = useState<Advocate[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [advView, setAdvView] = useState<View>("table");
  const [form, setForm] = useState({ employee_id: "", description: "", points: 1, date: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState("");
  const [empOpen, setEmpOpen] = useState(false);
  const [empDeptFilter, setEmpDeptFilter] = useState("");
  const [descSearch, setDescSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    getAdvocates()
      .then(setAdvocates)
      .catch(e => setFetchError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setForm(f => ({ ...f, date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }) }));
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

  const deptOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) { if (e.home_department) set.add(e.home_department); }
    return Array.from(set).sort();
  }, [employees]);

  // Filter by description first
  const dq = descSearch.trim().toLowerCase();
  const descFiltered = dq ? advocates.filter(a => a.description.toLowerCase().includes(dq)) : advocates;

  // Aggregate totals per employee (from description-filtered list)
  const totals: Record<string, { name: string; points: number; count: number }> = {};
  for (const a of descFiltered) {
    totals[a.employee_id] ??= { name: a.employee_name, points: 0, count: 0 };
    totals[a.employee_id].points += a.points;
    totals[a.employee_id].count += 1;
  }
  const q = search.trim().toLowerCase();
  const sorted = Object.entries(totals)
    .filter(([id, info]) => (!deptEmployeeIds || deptEmployeeIds.has(id) || id.startsWith("__name__")) && (!q || info.name.toLowerCase().includes(q)))
    .sort((a, b) => b[1].points - a[1].points);
  const maxPts = sorted[0]?.[1].points ?? 1;

  const filtered = selectedEmployee
    ? descFiltered.filter(a => a.employee_id === selectedEmployee)
    : descFiltered;

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl shimmer" />)}</div>;

  if (fetchError) return <Alert type="error">{fetchError}</Alert>;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <SearchInput
            value={descSearch}
            onChange={e => setDescSearch(e.target.value)}
            onClear={() => setDescSearch("")}
            placeholder="חיפוש לפי סוג סנגור..."
            className="flex-1 max-w-xs"
          />
          <Button onClick={() => { setShowForm(v => !v); setSaveError(null); }} icon={<Plus className="w-4 h-4" />}>
            הוסף סנגור
          </Button>
        </div>
        <Toggle
          labelOff="טבלה"
          labelOn="גרף"
          checked={advView === "chart"}
          onChange={v => setAdvView(v ? "chart" : "table")}
        />
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-slate-800">סנגור חדש</h3>
          {saveError && <Alert type="error">{saveError}</Alert>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">עובד</label>
              <div className="flex gap-2">
                {deptOptions.length > 0 && (
                  <Select
                    value={empDeptFilter}
                    onChange={e => { setEmpDeptFilter(e.target.value); setForm(f => ({ ...f, employee_id: "" })); setEmpSearch(""); }}
                    optionPrefix="כל המחלקות"
                    className="w-36 shrink-0"
                  >
                    {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
                  </Select>
                )}
                <div className="relative flex-1">
                  <Input
                    type="text"
                    value={empSearch}
                    onChange={e => { setEmpSearch(e.target.value); setEmpOpen(true); setForm(f => ({ ...f, employee_id: "" })); }}
                    onFocus={() => setEmpOpen(true)}
                    placeholder="הקלד שם עובד..."
                    autoComplete="off"
                    className={form.employee_id ? "border-blue-300 bg-blue-50/40" : ""}
                  />
                  {form.employee_id && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500"><Check className="w-3.5 h-3.5" /></span>
                  )}
                  {empOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setEmpOpen(false)} />
                      <div className="absolute z-50 top-full mt-1 right-0 left-0 bg-white rounded-xl shadow-xl border border-slate-200 max-h-52 overflow-y-auto" dir="rtl">
                        {employees
                          .filter(em =>
                            (!empDeptFilter || em.home_department === empDeptFilter) &&
                            (!empSearch.trim() || em.name.toLowerCase().includes(empSearch.toLowerCase()))
                          )
                          .map(em => (
                            <button key={em.id} type="button"
                              onClick={() => { setForm(f => ({ ...f, employee_id: em.id })); setEmpSearch(em.name); setEmpOpen(false); }}
                              className={`w-full text-right px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${form.employee_id === em.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700"}`}>
                              <span>{em.name}</span>
                              {em.home_department && !empDeptFilter && (
                                <span className="text-xs text-slate-400 mr-2">{em.home_department}</span>
                              )}
                            </button>
                          ))}
                        {employees.filter(em =>
                          (!empDeptFilter || em.home_department === empDeptFilter) &&
                          (!empSearch.trim() || em.name.toLowerCase().includes(empSearch.toLowerCase()))
                        ).length === 0 && (
                          <p className="text-center text-slate-400 text-sm py-3">לא נמצאו עובדים</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <input type="text" required readOnly value={form.employee_id} className="sr-only" tabIndex={-1} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">תאריך</label>
              <Input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">תיאור הסנגור</label>
              <Input required type="text" value={form.description} placeholder="מה עשה העובד?"
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">נקודות</label>
              <Input required type="number" min={1} max={100} value={form.points}
                onChange={e => setForm(f => ({ ...f, points: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>ביטול</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "שומר..." : "שמור"}
            </Button>
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
            <Button type="button" variant="ghost" onClick={() => setSelectedEmployee(null)} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="divide-y divide-slate-50">
            {filtered.map(a => (
              <div key={a.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-all">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{a.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{a.date}</p>
                </div>
                <span className="text-sm font-bold text-purple-600 shrink-0">{a.points} נק׳</span>
                <DeleteIconButton onClick={() => handleDelete(a.id)} className="shrink-0" />
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-slate-400 text-sm py-8">אין סנגורים עדיין</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shirking Breakdown modal ──────────────────────────────────────────────────
function ShirkingBreakdownModal({ 
  employeeName, 
  records, 
  manualPoints, 
  onClose,
  onRemoveRecord 
}: {
  employeeName: string;
  records: ShirkingRecord[];
  manualPoints: ManualPoint[];
  onClose: () => void;
  onRemoveRecord: (id: string) => Promise<void>;
}) {
  const total = records.length + manualPoints.reduce((sum, p) => sum + p.points, 0);

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
            <h2 className="font-bold text-slate-800 text-lg">{employeeName}</h2>
            <p className="text-xs text-slate-400 mt-0.5">פירוט הברזות</p>
          </div>
          <div className="text-2xl font-bold text-rose-600 ml-4">{total} הברזות</div>
          <button onClick={onClose} className="ml-3 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {records.length === 0 && manualPoints.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">אין הברזות רשומות</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {records.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 transition-all">
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-slate-800">{r.shift_name}</span>
                    <span className="text-xs text-slate-400 mx-2">{r.day}/{r.month}/{r.year}</span>
                    {r.replacement_name && <span className="text-xs text-slate-500 block mt-0.5">הוחלף ע״י {r.replacement_name}</span>}
                  </div>
                  <button type="button" onClick={() => onRemoveRecord(r.id)} className="text-slate-300 hover:text-red-400 transition-all shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {manualPoints.map(mp => (
                <div key={mp.id} className="flex items-center gap-3 px-6 py-3 hover:bg-amber-50 bg-amber-50/40 transition-all">
                  <div className="flex-1">
                     <span className="text-sm font-semibold text-slate-800">{mp.reason || "ניקוד ידני"}</span>
                     <span className="text-xs text-slate-400 mx-2">{new Date(mp.created_at).toLocaleDateString("he-IL")}</span>
                  </div>
                  <span className={`text-sm font-bold ${mp.points > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {mp.points > 0 ? "+" : ""}{mp.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shirking section ──────────────────────────────────────────────────────────
function ShirkingSection({ search, volunteerData, manualTotals = {}, onAddManualPoint, employees = [], manualPoints = [], deptEmployeeIds, startDate, endDate }: {
  search: string;
  volunteerData?: JusticeEntry[];
  manualTotals?: Record<string, number>;
  onAddManualPoint?: (id: string, name: string, pts: number, reason: string, table: ManualPointTable) => Promise<void>;
  employees?: Employee[];
  manualPoints?: ManualPoint[];
  deptEmployeeIds?: Set<string>;
  startDate?: string;
  endDate?: string;
}) {
  const [records, setRecords] = useState<ShirkingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sideBySide, setSideBySide] = useState(false);
  const [shiftSearch, setShiftSearch] = useState("");
  const [breakdownEmp, setBreakdownEmp] = useState<{id: string, name: string} | null>(null);

  const fetchRecords = useCallback(() => {
    setLoading(true);
    setError(null);
    getShirking(undefined, undefined, startDate, endDate)
      .then(setRecords)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  useEffect(() => {
    fetchRecords();
    const onVisible = () => { if (document.visibilityState === "visible") fetchRecords(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchRecords]);

  async function handleDelete(id: string) {
    await removeShirking(id).catch(() => {});
    setRecords(prev => prev.filter(r => r.id !== id));
  }

  const q = search.trim().toLowerCase();
  const sq = shiftSearch.trim().toLowerCase();

  // Filter by shift name first
  const shiftFiltered = sq ? records.filter(r => r.shift_name.toLowerCase().includes(sq)) : records;

  // Aggregate per employee — use employee_id as key, fall back to name if id is missing
  const totals: Record<string, { name: string; count: number }> = {};
  for (const r of shiftFiltered) {
    const key = r.employee_id || `__name__${r.employee_name}`;
    totals[key] ??= { name: r.employee_name, count: 0 };
    totals[key].count++;
  }

  // If no specific shift filter, ensure employees with manual points are included
  if (!sq) {
    for (const [empId, pts] of Object.entries(manualTotals)) {
      if (!totals[empId]) {
        const emp = employees.find(e => e.id === empId);
        const vEntry = volunteerData?.find(v => v.employee_id === empId);
        const name = emp?.name || vEntry?.employee_name;
        if (name) totals[empId] = { name, count: 0 };
      }
    }
  }

  const sorted = Object.entries(totals)
    .filter(([id, info]) => (!deptEmployeeIds || deptEmployeeIds.has(id) || id.startsWith("__name__")) && (!q || info.name.toLowerCase().includes(q)))
    .sort((a, b) => (b[1].count + (manualTotals[b[0]] ?? 0)) - (a[1].count + (manualTotals[a[0]] ?? 0)));
  
  const maxCount = Math.max(...sorted.map(([id, info]) => info.count + (manualTotals[id] ?? 0)), 1);

  const filteredRecords = shiftFiltered.filter(r => !q || r.employee_name.toLowerCase().includes(q));

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl shimmer"/>)}</div>;
  if (error) return <Alert type="error">{error}</Alert>;

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
            {sorted.map(([empId, info], rank) => {
              const manual = manualTotals[empId] ?? 0;
              const total = info.count + manual;
              return (
              <div key={empId} className="flex items-center gap-3 hover:bg-slate-50 p-2 rounded-xl -mx-2 cursor-pointer transition-colors" onClick={() => setBreakdownEmp({id: empId, name: info.name})}>
                <RankBadge rank={rank} />
                <div className="w-28 text-sm font-semibold text-slate-800 shrink-0 truncate">{info.name}</div>
                <Bar value={total} max={maxCount} color="bg-rose-400">
                  {total}
                </Bar>
                <div className="text-xs text-slate-400 shrink-0 w-20 text-left">{total} הברזות</div>
              </div>
            )})}
          </div>
        )
      }
      {breakdownEmp && (
        <ShirkingBreakdownModal
          employeeName={breakdownEmp.name}
          records={filteredRecords.filter(r => (r.employee_id || `__name__${r.employee_name}`) === breakdownEmp.id)}
          manualPoints={manualPoints.filter(p => p.employee_id === breakdownEmp.id)}
          onClose={() => setBreakdownEmp(null)}
          onRemoveRecord={handleDelete}
        />
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
  for (const r of shiftFiltered) {
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
      {/* Shift filter + balance toggle */}
      <div className="flex items-center justify-between gap-3">
        <SearchInput
          value={shiftSearch}
          onChange={setShiftSearch}
          placeholder="חיפוש לפי משמרת..."
          className="flex-1 max-w-xs"
        />
        {volunteerData && (
          <Toggle
            labelOff="הסתר מאזן"
            labelOn="הצג מאזן"
            checked={sideBySide}
            onChange={setSideBySide}
          />
        )}
      </div>

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
                  <th className="px-4 py-2.5 text-center"><span className="inline-flex items-center gap-1"><Handshake className="w-3.5 h-3.5" />התנדבויות</span></th>
                  <th className="px-4 py-2.5 text-center"><span className="inline-flex items-center gap-1"><Ban className="w-3.5 h-3.5" />הברזות</span></th>
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
  data, search, onEmployeeClick, manualTotals = {}, allEmployees = [],
  filter, onFilterChange
}: {
  data: DayTypeJusticeData;
  search: string;
  onEmployeeClick?: (id: string, name: string) => void;
  manualTotals?: Record<string, number>;
  allEmployees?: Employee[];
  filter: DayTypeFilter;
  onFilterChange: (f: DayTypeFilter) => void;
}) {
  const q = search.trim();

  const employees = data.employees
    .filter(e => !q || e.name.includes(q))
    .map(e => {
      // Fix: Find ID from allEmployees to look up manual totals correctly
      // Robust matching: trim and lowercase
      const norm = (s: string) => s.trim().toLowerCase();
      const targetName = norm(e.name);
      const empId = allEmployees.find(emp => norm(emp.name) === targetName)?.id || ""; // ensure string
      const manual = (empId ? manualTotals[empId] : 0) ?? 0;
      const shabbatScore = e.shabbat_score;
      const holidaysScore = e.total_score - e.shabbat_score;
      return { ...e, combined_score: e.total_score + manual, manual, empId, shabbatScore, holidaysScore };
    })
    .sort((a, b) => {
      if (filter === "shabbat") return b.shabbatScore - a.shabbatScore;
      if (filter === "holidays") return b.holidaysScore - a.holidaysScore;
      return b.combined_score - a.combined_score;
    });

  const maxTotal = Math.max(...employees.map(e =>
    filter === "shabbat" ? e.shabbatScore :
    filter === "holidays" ? e.holidaysScore :
    e.combined_score
  ), 1);

  // Which day types actually have any counts in this data
  const activeDayTypes = data.day_types.filter(dt =>
    employees.some(e => e.by_type[dt.id]?.count > 0)
  );
  const hasShabbat = employees.some(e => e.shabbat_count > 0);

  return (
    <div className="space-y-4">
      {employees.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 text-slate-400 text-sm">
          אין נתוני שבתות / חגים בטווח הנבחר
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-slate-800">
                {filter === "combined" ? "ציון שבתות וחגים — משולב" :
                 filter === "shabbat" ? "טבלת שבתות" : "טבלת חגים"}
              </h3>
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
                onClick={() => onEmployeeClick?.(e.empId, e.name)}
                title={onEmployeeClick ? "לחץ לפירוט" : undefined}
              >
                <RankBadge rank={rank} />
                <div className="w-28 text-sm font-semibold text-slate-800 shrink-0 truncate">{e.name}</div>
                {(() => {
                  const val = filter === "shabbat" ? e.shabbatScore : filter === "holidays" ? e.holidaysScore : e.combined_score;
                  return (
                    <>
                      <Bar value={val} max={maxTotal} color={rank === 0 ? "bg-purple-500" : rank === 1 ? "bg-purple-300" : "bg-purple-200"}>
                        {val}
                      </Bar>
                      <div className="text-xs text-slate-400 shrink-0 w-20 text-left">{val} נק׳</div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TABLE_LABELS: Partial<Record<ManualPointTable, string>> = {
  justice:   "צדק",
  volunteer: "התנדבות",
  // advocates: "סנגורים",
  shirking:  "הברזות",
  daytype:   "שבתות וחגים",
  oncall:    "כוננות",
  // general:   "כללי",
};

// ── Manual points section (tracking table) ────────────────────────────────────
function ManualPointsSection({ points, manualTotalsByTable, employees, onAdd, onRemove }: {
  points: ManualPoint[];
  manualTotalsByTable: Partial<Record<ManualPointTable, Record<string, number>>>;
  employees: Employee[];
  onAdd: (empId: string, empName: string, pts: number, reason: string, table: ManualPointTable, date?: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [empSearch, setEmpSearch] = useState("");
  const [empOpen, setEmpOpen]     = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<{ id: string; name: string } | null>(null);
  const [points_val, setPointsVal] = useState(1);
  const [reason, setReason]       = useState("");
  const [customDate, setCustomDate] = useState("");
  const [selectedTable, setSelectedTable] = useState<ManualPointTable>("justice");
  const [saving, setSaving]       = useState(false);
  const empBtnRef = useRef<HTMLButtonElement>(null);
  const [empStyle, setEmpStyle]   = useState<React.CSSProperties>({});
  const [filterEmp, setFilterEmp] = useState("");
  const [filterTable, setFilterTable] = useState<ManualPointTable | "all">("all");

  useEffect(() => {
    setCustomDate(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }));
  }, []);

  const openEmpDropdown = () => {
    if (empBtnRef.current) {
      const r = empBtnRef.current.getBoundingClientRect();
      setEmpStyle({ position: "fixed", top: r.bottom + 4, right: window.innerWidth - r.right, minWidth: r.width });
    }
    setEmpOpen(true);
  };

  const filteredEmps = employees.filter(e => !empSearch.trim() || e.name.toLowerCase().includes(empSearch.toLowerCase()));

  const handleSubmit = async (sign: 1 | -1) => {
    if (!selectedEmp || !points_val) return;
    setSaving(true);
    try {
      await onAdd(selectedEmp.id, selectedEmp.name, sign * Math.abs(points_val), reason, selectedTable, customDate);
      setReason(""); setPointsVal(1);
    } finally { setSaving(false); }
  };

  const fq = filterEmp.trim().toLowerCase();
  const filtered = points
    .filter(p => filterTable === "all" || p.table === filterTable)
    .filter(p => !fq || p.employee_name.toLowerCase().includes(fq));

  // Aggregate per employee (all tables combined) for summary
  const globalTotals: Record<string, { name: string; total: number }> = {};
  for (const mp of points) {
    globalTotals[mp.employee_id] ??= { name: mp.employee_name, total: 0 };
    globalTotals[mp.employee_id].total += mp.points;
  }
  const summary = Object.entries(globalTotals)
    .map(([id, v]) => ({ id, name: v.name, total: v.total }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Add form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">הוסף / הורד נקודות ידנית</h3>
          <p className="text-xs text-slate-400 mt-0.5">בחר עובד, תאריך וטבלה — הניקוד יתווסף לטבלאות הרלוונטיות</p>
        </div>
        <div className="p-5 flex flex-wrap gap-3 items-end">
          {/* Employee picker */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1">עובד</label>
            <button ref={empBtnRef} type="button" onClick={openEmpDropdown}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold text-slate-700 hover:border-blue-300 min-w-[160px]">
              {selectedEmp ? selectedEmp.name : <span className="text-slate-400">בחר עובד</span>}
              <ChevronDown className="w-4 h-4 text-slate-400 mr-auto" />
            </button>
            {empOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setEmpOpen(false)} />
                <div style={empStyle} className="z-[9999] bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto" dir="rtl">
                  <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                    <input autoFocus value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                      placeholder="חיפוש עובד..." onClick={e => e.stopPropagation()}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                  </div>
                  {filteredEmps.map(e => (
                    <button key={e.id} type="button"
                      onClick={() => { setSelectedEmp({ id: e.id, name: e.name }); setEmpSearch(""); setEmpOpen(false); }}
                      className="w-full text-right px-3 py-2 text-sm hover:bg-blue-50 transition-colors text-slate-700">
                      {e.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Table selector */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">טבלה</label>
            <select value={selectedTable} onChange={e => setSelectedTable(e.target.value as ManualPointTable)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100">
              {(Object.entries(TABLE_LABELS) as [ManualPointTable, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          {/* Date Picker */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">תאריך לחישוב</label>
            <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          {/* Points stepper */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">נקודות</label>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPointsVal(p => Math.max(1, p - 1))}
                className="w-8 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 flex items-center justify-center transition-colors">−</button>
              <input type="number" min={1} value={points_val}
                onChange={e => setPointsVal(Math.max(1, Number(e.target.value)))}
                className="w-16 text-center text-sm font-bold border border-slate-200 rounded-lg py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
              <button type="button" onClick={() => setPointsVal(p => p + 1)}
                className="w-8 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 flex items-center justify-center transition-colors">+</button>
            </div>
          </div>
          {/* Reason */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">סיבה (אופציונלי)</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)}
              placeholder="סיבה לניקוד ידני..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 bg-slate-50" />
          </div>
          {/* Buttons */}
          <div className="flex gap-2">
            <button type="button" disabled={saving || !selectedEmp} onClick={() => handleSubmit(1)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40">
              +{points_val} הוסף
            </button>
            <button type="button" disabled={saving || !selectedEmp} onClick={() => handleSubmit(-1)}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40">
              −{points_val} הורד
            </button>
          </div>
        </div>
      </div>

      {/* Summary per employee */}
      {summary.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">סיכום ניקוד ידני לפי עובד</h3>
          </div>
          <div className="p-5 space-y-2">
            {summary.map(row => (
              <div key={row.id} className="flex items-center gap-3">
                <div className="w-40 text-sm font-semibold text-slate-800 shrink-0 truncate">{row.name}</div>
                <span className={`text-base font-bold shrink-0 w-16 text-center ${row.total > 0 ? "text-emerald-600" : row.total < 0 ? "text-rose-500" : "text-slate-400"}`}>
                  {row.total > 0 ? "+" : ""}{row.total}
                </span>
                <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden relative">
                  <div className={`h-4 rounded-full transition-all duration-500 ${row.total > 0 ? "bg-emerald-400" : "bg-rose-400"}`}
                    style={{ width: `${summary.length > 0 ? (Math.abs(row.total) / Math.max(...summary.map(s => Math.abs(s.total)), 1)) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <h3 className="font-bold text-slate-800">יומן ניקוד ידני</h3>
          <input value={filterEmp} onChange={e => setFilterEmp(e.target.value)}
            placeholder="סנן לפי עובד..."
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-slate-50" />
          <select value={filterTable} onChange={e => setFilterTable(e.target.value as ManualPointTable | "all")}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300">
            <option value="all">כל הטבלאות</option>
            {(Object.entries(TABLE_LABELS) as [ManualPointTable, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400 mr-auto">{filtered.length} רשומות</span>
        </div>
        {filtered.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-10">אין רשומות ניקוד ידני</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="px-4 py-2.5 text-right">עובד</th>
                  <th className="px-4 py-2.5 text-center">נקודות</th>
                  <th className="px-4 py-2.5 text-right">טבלה</th>
                  <th className="px-4 py-2.5 text-right">סיבה</th>
                  <th className="px-4 py-2.5 text-right">תאריך</th>
                  <th className="px-4 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-800">{p.employee_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${p.points > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>
                        {p.points > 0 ? "+" : ""}{p.points}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{TABLE_LABELS[p.table ?? "general"]}</td>
                    <td className="px-4 py-3 text-slate-500">{p.reason || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">
                      {p.date
                        ? new Date(p.date).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : new Date(p.created_at).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })
                      }
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => onRemove(p.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function JusticePage() {
  const { mode } = useMode();
  const isNursing = mode.startsWith("nursing");

  const [data, setData] = useState<JusticeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("justice");
  const [view, setView] = useState<View>("table");
  const [employees, setEmployees] = useState<Employee[]>([]);
  useEffect(() => { console.log("[state] employees changed:", employees.length); }, [employees]);

  const [oncallData, setOncallData] = useState<OncallJusticeEntry[]>([]);
  const [oncallLoading, setOncallLoading] = useState(false);
  const [oncallError, setOncallError] = useState<string | null>(null);
  const [oncallDeptFilter, setOncallDeptFilter] = useState("");
  const [oncallSlotFilter, setOncallSlotFilter] = useState("");
  const [oncallView, setOncallView] = useState<"table" | "chart" | "detail">("table");
  const [oncallSplit, setOncallSplit] = useState(true);
  const [oncallBreakdownEmp, setOncallBreakdownEmp] = useState<{ id: string; name: string } | null>(null);
  const [oncallAllAssignments, setOncallAllAssignments] = useState<OncallBreakdownRow[]>([]);
  const [oncallDetailLoading, setOncallDetailLoading] = useState(false);

  // Extra data for combined tab
  const [advocates, setAdvocates] = useState<Advocate[]>([]);
  const [shirkingRecords, setShirkingRecords] = useState<ShirkingRecord[]>([]);

  const [dateRange, setDateRange] = useState<DateRangeValue | null>(null);

  useEffect(() => {
    getEmployees().then(r => { console.log("[init] employees:", r.length); setEmployees(r); }).catch(e => console.error("[init] getEmployees failed:", e));
    getAdvocates().then(setAdvocates).catch(() => {});
    getShirking().then(setShirkingRecords).catch(() => {});
    getOncallJustice().then(r => { console.log("[init] oncallJustice:", r.length, r); setOncallData(r); }).catch(e => console.error("[init] getOncallJustice failed:", e));
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        getShirking().then(setShirkingRecords).catch(() => {});
        getAdvocates().then(setAdvocates).catch(() => {});
        getOncallJustice().then(setOncallData).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const startISO = dateRange?.start ?? "";
  const endISO = dateRange?.end ?? "";

  const loadOncallJustice = useCallback(() => {
    setOncallLoading(true);
    setOncallError(null);
    getOncallJustice(startISO || undefined, endISO || undefined)
      .then(r => { console.log("[loadOncall] result:", r.length, "start:", startISO, "end:", endISO); setOncallData(r); })
      .catch(e => { console.error("[loadOncall] failed:", e); setOncallError((e as Error).message); })
      .finally(() => setOncallLoading(false));
  }, [startISO, endISO]);

  useEffect(() => {
    // Always load oncall data — it feeds the combined table even when not on the oncall tab
    loadOncallJustice();
  }, [loadOncallJustice]);

  // Debug: log whenever oncallData actually changes
  useEffect(() => {
    console.log("[oncallData changed]", oncallData.length, oncallData);
  }, [oncallData]);

  useEffect(() => {
    if (tab !== "oncall" || oncallView !== "detail") return;
    setOncallDetailLoading(true);
    getOncallAllAssignments(startISO || undefined, endISO || undefined)
      .then(setOncallAllAssignments)
      .catch(() => setOncallAllAssignments([]))
      .finally(() => setOncallDetailLoading(false));
  }, [tab, oncallView, startISO, endISO]);
  const rangeLabel = dateRange?.label ?? "";

  useEffect(() => {
    if (!startISO || !endISO) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getJustice(startISO, endISO)
      .then(setData)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [startISO, endISO]);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [daytypeData, setDaytypeData] = useState<DayTypeJusticeData | null>(null);
  const [daytypeLoading, setDaytypeLoading] = useState(false);
  const [daytypeError, setDaytypeError] = useState<string | null>(null);
  const [dayTypeFilter, setDayTypeFilter] = useState<DayTypeFilter>("combined");

  useEffect(() => {
    if (!startISO || !endISO) return;
    setDaytypeLoading(true);
    setDaytypeError(null);
    getDayTypeJustice(startISO, endISO)
      .then(setDaytypeData)
      .catch(e => setDaytypeError((e as Error).message))
      .finally(() => setDaytypeLoading(false));
  }, [startISO, endISO]);

  const [showDayScores, setShowDayScores] = useState(false);
  const [dayScoreData, setDayScoreData] = useState<DayTypeJusticeData | null>(null);
  const [breakdownEmployee, setBreakdownEmployee] = useState<{id: string, name: string} | null>(null);
  const [volunteerBreakdownEmployee, setVolunteerBreakdownEmployee] = useState<{id: string, name: string} | null>(null);
  const [daytypeBreakdownEmployee, setDaytypeBreakdownEmployee] = useState<{id: string, name: string} | null>(null);

  // Manual points
  const [manualPoints, setManualPoints] = useState<ManualPoint[]>([]);
  useEffect(() => {
    if (!startISO || !endISO) return;
    getManualPoints(startISO, endISO).then(setManualPoints).catch(() => {});
  }, [startISO, endISO]);

  // Filter manual points based on current date range (using created_at)
  const effectiveManualPoints = manualPoints.filter(mp => {
    if (!startISO || !endISO) return false;
    // Prefer logical date 'date', fallback to 'created_at' if missing
    const targetDate = mp.date || mp.created_at;
    const d = targetDate.slice(0, 10);
    return d >= startISO && d <= endISO;
  });

  // Per-table totals: { justice: { empId: total }, volunteer: { empId: total }, ... }
  const manualTotalsByTable: Partial<Record<ManualPointTable, Record<string, number>>> = {};
  for (const mp of effectiveManualPoints) {
    const t = mp.table ?? "general";
    if (!manualTotalsByTable[t]) manualTotalsByTable[t] = {};
    manualTotalsByTable[t]![mp.employee_id] = (manualTotalsByTable[t]![mp.employee_id] ?? 0) + mp.points;
  }
  // Combined totals across all tables (for CombinedTable)
  const allManualTotals: Record<string, number> = {};
  for (const mp of effectiveManualPoints) {
    allManualTotals[mp.employee_id] = (allManualTotals[mp.employee_id] ?? 0) + mp.points;
  }

  // Merge all employees into oncall data so employees with 0 oncall shifts are visible
  const oncallMerged = useMemo<(OncallJusticeEntry & { manual: number; display_total: number })[]>(() => {
    const oncallManual = manualTotalsByTable["oncall"] ?? {};
    const byId = new Map<string, OncallJusticeEntry>();
    for (const e of oncallData) {
      const key = e.employee_id || `__name__${e.employee_name}`;
      byId.set(key, e);
    }
    const result: OncallJusticeEntry[] = [...oncallData];
    for (const emp of employees) {
      if (!byId.has(emp.id) && !byId.has(`__name__${emp.name}`)) {
        result.push({
          employee_id: emp.id,
          employee_name: emp.name,
          from_department: emp.home_department ?? "",
          slot_counts: { "ערב_1": 0, "ערב_2": 0, "לילה": 0 },
          total: 0,
        });
      }
    }
    return result
      .map(e => {
        const manual = e.employee_id ? (oncallManual[e.employee_id] ?? 0) : 0;
        return { ...e, manual, display_total: e.total + manual };
      })
      .sort((a, b) => b.display_total - a.display_total);
  }, [oncallData, employees, manualTotalsByTable]);

  const allCombinedData = useMemo(() => {
    // shirking totals (count)
    const shirkingMap: Record<string, number> = {};
    for (const r of shirkingRecords) {
      const key = r.employee_id || `__name__${r.employee_name}`;
      shirkingMap[key] = (shirkingMap[key] ?? 0) + 1;
    }

    // advocates totals (points)
    const advocateMap: Record<string, number> = {};
    for (const a of advocates) {
      advocateMap[a.employee_id] = (advocateMap[a.employee_id] ?? 0) + a.points;
    }

    // oncall totals (count of shifts) — match by id first, fall back to name
    const oncallMap: Record<string, number> = {};
    console.log("[combined] oncallData:", oncallData.map(e => ({ id: e.employee_id, name: e.employee_name, total: e.total })));
    for (const e of oncallData) {
      if (e.employee_id) {
        oncallMap[e.employee_id] = (oncallMap[e.employee_id] ?? 0) + e.total;
      } else if (e.employee_name) {
        const matched = employees.find(em => em.name === e.employee_name);
        if (matched) oncallMap[matched.id] = (oncallMap[matched.id] ?? 0) + e.total;
      }
    }
    console.log("[combined] oncallMap:", oncallMap);
    console.log("[combined] employees sample:", employees.slice(0, 5).map(e => ({ id: e.id, name: e.name })));

    return employees.map(emp => {
      const justiceEntry = data.find(d => d.employee_id === emp.id);
      const daytypeEntry = daytypeData?.employees.find(d => d.name === emp.name);

      const justiceScore = justiceEntry?.justice_score ?? 0;
      const volunteerScore = justiceEntry?.volunteer_score ?? 0;
      const daytypeScore = daytypeEntry?.total_score ?? 0;
      const shirkingCount = shirkingMap[emp.id] ?? shirkingMap[`__name__${emp.name}`] ?? 0;
      const advocateScore = advocateMap[emp.id] ?? 0;
      const oncallCount = oncallMap[emp.id] ?? 0;

      const finalJustice = justiceScore + (manualTotalsByTable.justice?.[emp.id] ?? 0);
      const finalVolunteer = volunteerScore + (manualTotalsByTable.volunteer?.[emp.id] ?? 0);
      const finalDaytype = daytypeScore + (manualTotalsByTable.daytype?.[emp.id] ?? 0);
      const finalShirking = shirkingCount + (manualTotalsByTable.shirking?.[emp.id] ?? 0);
      const finalAdvocate = advocateScore + (manualTotalsByTable.advocates?.[emp.id] ?? 0);
      const finalOncall = oncallCount + (manualTotalsByTable.oncall?.[emp.id] ?? 0);

      const totalScore = finalJustice + finalVolunteer + finalDaytype + finalAdvocate + finalOncall - finalShirking;

      return {
        empId: emp.id,
        name: emp.name,
        scores: {
          justice: finalJustice,
          volunteer: finalVolunteer,
          daytype: finalDaytype,
          oncall: finalOncall,
          advocates: finalAdvocate,
          shirking: -finalShirking,
        },
        total: totalScore,
        manual: allManualTotals[emp.id] ?? 0,
      };
    }).sort((a, b) => b.total - a.total);
  }, [employees, data, daytypeData, shirkingRecords, advocates, oncallData, manualTotalsByTable, allManualTotals]);

  const departments = useMemo(() =>
    [...new Set(employees.map(e => e.home_department ?? "").filter(Boolean))].sort(),
    [employees]
  );

  const filteredEmployees = useMemo(() =>
    deptFilter ? employees.filter(e => e.home_department === deptFilter) : employees,
    [employees, deptFilter]
  );

  const filteredEmployeeIds = useMemo(() =>
    new Set(filteredEmployees.map(e => e.id)),
    [filteredEmployees]
  );

  const filteredData = useMemo(() =>
    deptFilter ? data.filter(e => filteredEmployeeIds.has(e.employee_id)) : data,
    [data, deptFilter, filteredEmployeeIds]
  );

  const filteredAllCombined = useMemo(() =>
    deptFilter ? allCombinedData.filter(e => filteredEmployeeIds.has(e.empId)) : allCombinedData,
    [allCombinedData, deptFilter, filteredEmployeeIds]
  );

  const filteredDaytypeData = useMemo(() => {
    if (!deptFilter || !daytypeData) return daytypeData;
    const deptNames = new Set(filteredEmployees.map(e => e.name));
    return { ...daytypeData, employees: daytypeData.employees.filter(e => deptNames.has(e.name)) };
  }, [daytypeData, deptFilter, filteredEmployees]);

  const handleAddManualPoint = async (empId: string, empName: string, pts: number, reason: string, table: ManualPointTable = "general", date?: string) => {
    // Pass optional date to API
    const created = await addManualPoint({ employee_id: empId, employee_name: empName, points: pts, reason, table, date } as any);
    setManualPoints(prev => [created, ...prev]);
  };
  const handleRemoveManualPoint = async (id: string) => {
    await removeManualPoint(id);
    setManualPoints(prev => prev.filter(p => p.id !== id));
  };

  useEffect(() => {
    if (!startISO || !endISO) return;
    if (!showDayScores) return;
    getDayTypeJustice(startISO, endISO)
      .then(setDayScoreData)
      .catch(() => setDayScoreData(null));
  }, [showDayScores, startISO, endISO]);

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "justice",   label: "טבלת צדק",         icon: <Scale className="w-3.5 h-3.5" /> },
    { id: "volunteer", label: "טבלת התנדבות",     icon: <Handshake className="w-3.5 h-3.5" /> },
    { id: "shirking",  label: "הברזות",            icon: <Ban className="w-3.5 h-3.5" /> },
    { id: "advocates", label: "סנגורים",           icon: <Trophy className="w-3.5 h-3.5" /> },
    { id: "daytype",   label: "שבתות וחגים",       icon: <Building2 className="w-3.5 h-3.5" /> },
    ...(isNursing ? [{ id: "oncall" as Tab, label: "כוננות", icon: <PhoneCall className="w-3.5 h-3.5" /> }] : []),
    { id: "combined",  label: "טבלה משולבת",       icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { id: "manual",    label: "ניקוד ידני",        icon: <Pencil className="w-3.5 h-3.5" /> },
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
      <SearchDropdown
        value={search}
        onChange={setSearch}
        options={employees.map(e => e.name)}
        placeholder="חיפוש לפי שם עובד..."
        className="max-w-xs w-full"
      />

      {/* Tab selector + filters */}
      <div className="flex flex-col gap-3">
      <TabsContainer>
        {tabs.map(t => (
          <TabButton key={t.id} onClick={() => setTab(t.id)} active={tab === t.id} className="px-4 py-2">
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </TabButton>
        ))}
      </TabsContainer>

      {/* Department filter pills — shown when multiple departments exist, hidden on oncall tab */}
      {departments.length > 1 && tab !== "oncall" && (
        <div className="flex items-center gap-2 flex-wrap">
          <FilterPill active={!deptFilter} onClick={() => setDeptFilter("")}>כל המחלקות</FilterPill>
          {departments.map(dept => (
            <FilterPill key={dept} active={deptFilter === dept} onClick={() => setDeptFilter(dept)}>{dept}</FilterPill>
          ))}
        </div>
      )}

      {/* Filters row — all controls on one line, left/right split */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* RIGHT side (start in RTL): time range — hidden on advocates tab */}
        {!(tab === "advocates") ? (
          <DateRangePicker
            availableTypes={["week", "month", "year", "all", "custom"]}
            defaultType="month"
            onChange={setDateRange}
          />
        ) : <div />}

        {/* LEFT side (end in RTL): view binary toggle + day scores toggle + daytype filter */}
        <div className="flex items-center gap-2">
          {/* View binary toggle — hidden on advocates/shirking/daytype/combined tabs */}
          {tab === "oncall" && (
            <div className="flex items-center gap-2">
              {oncallView === "table" && (
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                  <button onClick={() => setOncallSplit(true)}
                    className={`px-3 py-1.5 transition-colors ${oncallSplit ? "bg-orange-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                    ערב / לילה
                  </button>
                  <button onClick={() => setOncallSplit(false)}
                    className={`px-3 py-1.5 transition-colors border-r border-slate-200 ${!oncallSplit ? "bg-orange-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                    משולב
                  </button>
                </div>
              )}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                {(["table", "detail", "chart"] as const).map((v, i) => (
                  <button key={v} onClick={() => setOncallView(v)}
                    className={`px-3 py-1.5 transition-colors ${oncallView === v ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"} ${i > 0 ? "border-r border-slate-200" : ""}`}>
                    {v === "table" ? "סיכום" : v === "detail" ? "פר משמרת" : "גרף"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!(tab === "advocates" || tab === "shirking" || tab === "daytype" || tab === "combined" || tab === "oncall") && (
            <Toggle
              labelOff="טבלה"
              labelOn="גרף"
              checked={view === "chart"}
              onChange={v => setView(v ? "chart" : "table")}
            />
          )}

          {/* Day scores toggle — visible on justice/combined tabs */}
          {(tab === "justice" || tab === "combined") && (
            <Toggle
              labelOff="ימי חול"
              labelOn="כולל שבת/חגים"
              checked={showDayScores}
              onChange={setShowDayScores}
            />
          )}

          {/* Daytype filter dropdown — visible on daytype tab */}
          {tab === "daytype" && (
            <div className="flex items-center gap-1.5">
              <Select value={dayTypeFilter} optionPrefix="הצג" onChange={e => setDayTypeFilter(e.target.value as "combined" | "shabbat" | "holidays")} className="w-auto text-xs">
                <option value="combined">משולב</option>
                <option value="shabbat">שבתות</option>
                <option value="holidays">חגים</option>
              </Select>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Error */}
      {tab !== "advocates" && tab !== "shirking" && tab !== "daytype" && tab !== "manual" && tab !== "oncall" && error && (
        <Alert type="error">{error}</Alert>
      )}

      {/* Loading */}
      {tab !== "advocates" && tab !== "shirking" && tab !== "daytype" && tab !== "manual" && tab !== "oncall" && loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-2xl shimmer" />)}
        </div>
      )}

      {/* Oncall justice tab */}
      {tab === "oncall" && (() => {
        const filteredOncall = oncallMerged.filter(e => {
          if (search && !e.employee_name.toLowerCase().includes(search.toLowerCase())) return false;
          if (oncallDeptFilter && e.from_department !== oncallDeptFilter) return false;
          if (oncallSlotFilter && (e.slot_counts[oncallSlotFilter] || 0) === 0) return false;
          return true;
        });
        const oncallMax = Math.max(...filteredOncall.map(e => oncallSlotFilter ? (e.slot_counts[oncallSlotFilter] || 0) : e.display_total), 1);
        const allDepts = [...new Set(oncallMerged.map(e => e.from_department).filter(Boolean))].sort();

        return (
          <div className="flex flex-col gap-3">
            {/* Sub-filters row (dept + slot) */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 font-medium">מחלקה</span>
                <select
                  value={oncallDeptFilter}
                  onChange={e => setOncallDeptFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">הכל</option>
                  {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 font-medium">סוג כוננות</span>
                <select
                  value={oncallSlotFilter}
                  onChange={e => setOncallSlotFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">הכל</option>
                  <option value="ערב_1">ערב I</option>
                  <option value="ערב_2">ערב II</option>
                  <option value="לילה">לילה</option>
                </select>
              </div>
            </div>

            {oncallError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{oncallError}</div>
            )}

            {oncallLoading || (oncallView === "detail" && oncallDetailLoading) ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl shimmer"/>)}</div>
            ) : oncallView === "detail" ? (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800">כל הכוננויות — פר משמרת</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{oncallAllAssignments.length} כוננויות</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">תאריך</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">יום</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">סוג כוננות</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">עובד</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">מחלקה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oncallAllAssignments
                        .filter(r => !oncallSlotFilter || r.slot === oncallSlotFilter)
                        .filter(r => !oncallDeptFilter || r.from_department === oncallDeptFilter)
                        .filter(r => !search || r.employee_name.toLowerCase().includes(search.toLowerCase()))
                        .map((r, i) => (
                          <tr key={i} className={`border-b border-slate-50 hover:bg-orange-50/30 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                            <td className="px-4 py-2.5 text-slate-600 tabular-nums">{r.date}</td>
                            <td className="px-4 py-2.5 text-slate-700 font-medium">{r.day_of_week}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${SLOT_COLORS[r.slot] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                                {r.slot_label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-medium text-slate-800">{r.employee_name}</td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs">{r.from_department}</td>
                          </tr>
                        ))}
                      {oncallAllAssignments.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">אין כוננויות בטווח הנבחר</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : oncallView === "chart" ? (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800">גרף כוננויות</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {oncallSlotFilter ? { "ערב_1": "ערב I", "ערב_2": "ערב II", "לילה": "לילה" }[oncallSlotFilter] : "סה״כ כל סוגי הכוננות"}
                  </p>
                </div>
                <div className="p-6">
                  <div className="flex items-end gap-2 h-48 border-b border-slate-200 pb-2 overflow-x-auto">
                    {filteredOncall.map((e, i) => {
                      const val = oncallSlotFilter ? (e.slot_counts[oncallSlotFilter] || 0) : e.display_total;
                      const barH = oncallMax > 0 ? Math.max(val > 0 ? 4 : 0, Math.round((val / oncallMax) * 150)) : 0;
                      return (
                        <div key={e.employee_id || e.employee_name} className="flex flex-col items-center gap-1 min-w-[44px]">
                          <span className="text-xs font-bold text-slate-600">{val || ""}</span>
                          <div className="w-8 rounded-t-lg transition-all duration-500"
                            style={{ height: `${barH}px`, background: val === 0 ? "#e2e8f0" : i < 3 ? "#f59e0b" : "#60a5fa" }} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {filteredOncall.map(e => (
                      <div key={e.employee_id || e.employee_name} className="min-w-[44px] text-center text-[10px] text-slate-500 truncate">{e.employee_name}</div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (() => {
              const eveningCount = (e: typeof filteredOncall[0]) => (e.slot_counts["ערב_1"] || 0) + (e.slot_counts["ערב_2"] || 0);
              const nightCount  = (e: typeof filteredOncall[0]) => e.slot_counts["לילה"] || 0;

              const OncallSubTable = ({ rows, title, color }: { rows: { emp: typeof filteredOncall[0]; count: number }[]; title: string; color: string }) => (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex-1 min-w-0">
                  <div className={`px-5 py-3 border-b border-slate-100 ${color}`}>
                    <h4 className="font-bold text-sm">{title}</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2.5 text-right font-semibold text-slate-600 text-xs">#</th>
                          <th className="px-3 py-2.5 text-right font-semibold text-slate-600 text-xs">עובד</th>
                          <th className="px-3 py-2.5 text-right font-semibold text-slate-600 text-xs">מחלקה</th>
                          <th className="px-3 py-2.5 text-center font-semibold text-slate-600 text-xs">כוננויות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ emp: e, count }, idx) => (
                          <tr key={e.employee_id || e.employee_name} className={`border-b border-slate-50 hover:bg-orange-50/30 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} ${count === 0 ? "opacity-40" : ""}`}>
                            <td className="px-3 py-2 text-slate-400 text-xs">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <button
                                className="font-medium text-slate-800 hover:text-orange-600 hover:underline transition-colors text-right text-sm"
                                onClick={() => e.employee_id && setOncallBreakdownEmp({ id: e.employee_id, name: e.employee_name })}
                              >{e.employee_name}</button>
                            </td>
                            <td className="px-3 py-2 text-slate-500 text-xs">{e.from_department}</td>
                            <td className="px-3 py-2 text-center font-semibold tabular-nums text-slate-800">{count}</td>
                          </tr>
                        ))}
                        {rows.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">אין נתונים</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );

              if (!oncallSplit) {
                // Combined view: total = evening + night + manual
                const combinedRows = filteredOncall
                  .map(e => ({ emp: e, count: e.display_total }))
                  .sort((a, b) => b.count - a.count);
                return (
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 text-slate-700">
                      <h4 className="font-bold text-sm">סה״כ כוננויות — משולב</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2.5 text-right font-semibold text-slate-600 text-xs">#</th>
                            <th className="px-4 py-2.5 text-right font-semibold text-slate-600 text-xs">עובד</th>
                            <th className="px-4 py-2.5 text-right font-semibold text-slate-600 text-xs">מחלקה</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-amber-600 text-xs">ערב</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-indigo-600 text-xs">לילה</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-blue-600 text-xs">ניקוד ידני</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-slate-700 text-xs">סה״כ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combinedRows.map(({ emp: e, count }, idx) => (
                            <tr key={e.employee_id || e.employee_name} className={`border-b border-slate-50 hover:bg-orange-50/30 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} ${count === 0 ? "opacity-40" : ""}`}>
                              <td className="px-4 py-2 text-slate-400 text-xs">{idx + 1}</td>
                              <td className="px-4 py-2">
                                <button
                                  className="font-medium text-slate-800 hover:text-orange-600 hover:underline transition-colors text-right text-sm"
                                  onClick={() => e.employee_id && setOncallBreakdownEmp({ id: e.employee_id, name: e.employee_name })}
                                >{e.employee_name}</button>
                              </td>
                              <td className="px-4 py-2 text-slate-500 text-xs">{e.from_department}</td>
                              <td className="px-4 py-2 text-center tabular-nums text-amber-700">{eveningCount(e) || "—"}</td>
                              <td className="px-4 py-2 text-center tabular-nums text-indigo-700">{nightCount(e) || "—"}</td>
                              <td className="px-4 py-2 text-center tabular-nums text-blue-600 font-medium">
                                {e.manual !== 0 ? (e.manual > 0 ? `+${e.manual}` : e.manual) : "—"}
                              </td>
                              <td className="px-4 py-2 text-center font-semibold tabular-nums text-slate-800">{count}</td>
                            </tr>
                          ))}
                          {combinedRows.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">לא נמצאו תוצאות</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              const eveningRows = filteredOncall
                .filter(e => !oncallSlotFilter || oncallSlotFilter !== "לילה")
                .map(e => ({ emp: e, count: eveningCount(e) }))
                .sort((a, b) => b.count - a.count);
              const nightRows = filteredOncall
                .filter(e => !oncallSlotFilter || oncallSlotFilter === "לילה")
                .map(e => ({ emp: e, count: nightCount(e) }))
                .sort((a, b) => b.count - a.count);

              return (
                <div className="flex gap-4 items-start">
                  {(!oncallSlotFilter || oncallSlotFilter !== "לילה") && (
                    <OncallSubTable rows={eveningRows} title="ערב (ערב I + ערב II)" color="text-amber-700" />
                  )}
                  {(!oncallSlotFilter || oncallSlotFilter === "לילה") && (
                    <OncallSubTable rows={nightRows} title="לילה" color="text-indigo-700" />
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {oncallBreakdownEmp && (
        <OncallBreakdownModal
          employeeId={oncallBreakdownEmp.id}
          employeeName={oncallBreakdownEmp.name}
          manualPoints={effectiveManualPoints.filter(p => p.table === "oncall")}
          startDate={startISO || undefined}
          endDate={endISO || undefined}
          onClose={() => setOncallBreakdownEmp(null)}
        />
      )}

      {tab === "advocates" && <AdvocatesSection employees={filteredEmployees} search={search} manualTotals={manualTotalsByTable["advocates"] ?? {}} deptEmployeeIds={filteredEmployeeIds} />}

      {/* Shirking tab — independent of justice loading */}
      {tab === "shirking" && <ShirkingSection search={search} volunteerData={filteredData} manualTotals={manualTotalsByTable["shirking"] ?? {}} employees={filteredEmployees} onAddManualPoint={handleAddManualPoint} manualPoints={effectiveManualPoints.filter(p => p.table === "shirking")} deptEmployeeIds={filteredEmployeeIds} startDate={startISO || undefined} endDate={endISO || undefined} />}

      {/* Daytype tab */}
      {tab === "daytype" && (
        daytypeLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl shimmer"/>)}</div>
        ) : daytypeError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{daytypeError}</div>
        ) : daytypeData ? (
          <DayTypeJusticeSection data={filteredDaytypeData ?? daytypeData} search={search} onEmployeeClick={(id, name) => setDaytypeBreakdownEmployee({ id, name })} manualTotals={manualTotalsByTable["daytype"] ?? {}} allEmployees={filteredEmployees} filter={dayTypeFilter} onFilterChange={setDayTypeFilter} />
        ) : null
      )}

      {/* Manual points tab */}
      {tab === "manual" && (
        <ManualPointsSection
          points={effectiveManualPoints}
          manualTotalsByTable={manualTotalsByTable}
          employees={filteredEmployees}
          onAdd={handleAddManualPoint}
          onRemove={handleRemoveManualPoint}
        />
      )}

      {/* Breakdown modals */}
      {breakdownEmployee && (
        <BreakdownModal
          employee={breakdownEmployee.name}
          employeeId={breakdownEmployee.id}
          manualPoints={effectiveManualPoints.filter(p => p.table === "justice")}
          startDate={startISO}
          endDate={endISO}
          onClose={() => setBreakdownEmployee(null)}
        />
      )}
      {volunteerBreakdownEmployee && (
        <VolunteerBreakdownModal
          employee={volunteerBreakdownEmployee.name}
          employeeId={volunteerBreakdownEmployee.id}
          manualPoints={effectiveManualPoints.filter(p => p.table === "volunteer")}
          startDate={startISO}
          endDate={endISO}
          onClose={() => setVolunteerBreakdownEmployee(null)}
        />
      )}
      {daytypeBreakdownEmployee && (
        <DayTypeBreakdownModal
          employee={daytypeBreakdownEmployee.name}
          employeeId={daytypeBreakdownEmployee.id}
          manualPoints={effectiveManualPoints.filter(p => p.table === "daytype")}
          startDate={startISO}
          endDate={endISO}
          onClose={() => setDaytypeBreakdownEmployee(null)}
          filter={dayTypeFilter}
        />
      )}

      {/* Content for justice/volunteer/combined */}
      {tab !== "advocates" && tab !== "shirking" && tab !== "daytype" && tab !== "manual" && tab !== "oncall" && !loading && !error && (
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
                    data={filteredData}
                    view={view}
                    search={search}
                    getDayScore={showDayScores ? getDayScoreForEmployee : undefined}
                    onEmployeeClick={view === "table" ? (id, name) => setBreakdownEmployee({ id, name }) : undefined}
                    manualTotals={manualTotalsByTable["justice"] ?? {}}
                  />
                )}
                {tab === "volunteer" && (
                  <VolunteerSection
                    data={filteredData}
                    view={view}
                    search={search}
                    onEmployeeClick={view === "table" ? (id, name) => setVolunteerBreakdownEmployee({ id, name }) : undefined}
                    manualTotals={manualTotalsByTable["volunteer"] ?? {}}
                  />
                )}
                {tab === "combined" && (
                  <AllCombinedTable data={filteredAllCombined} search={search} />
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
