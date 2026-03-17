"use client";
import { useState } from "react";
import { useShiftTypes } from "@/hooks/useShiftTypes";
import type { ShiftType } from "@/lib/types";

const COL_TO_SHIFTS: Record<number, number[]> = {
  1: [1,2,3,4,5], 2:[6], 3:[7], 4:[7,8],
  5:[9], 6:[10], 7:[12], 8:[13],
};
const COL_COLORS = [
  "bg-violet-100 text-violet-700 border-violet-200",
  "bg-sky-100 text-sky-700 border-sky-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-cyan-100 text-cyan-700 border-cyan-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-teal-100 text-teal-700 border-teal-200",
];
const COL_NAMES: Record<number, string> = {
  1: "כוננות מחלקה",
  2: "מיון 14:00",
  3: "מיון 1 - צעיר",
  4: "מיון 2 - ותיק",
  5: "תורן מחלקות",
  6: "תורן גריאטריה",
  7: "כונן נוער",
  8: "תורנות מיון שישי",
};

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} type="button"
      className={`toggle-track border-2 transition-colors ${checked ? "bg-amber-400 border-amber-400" : "bg-slate-200 border-slate-200"}`}>
      <div className="toggle-thumb" style={{ transform: checked ? "translateX(20px)" : "translateX(3px)" }} />
    </button>
  );
}

export default function ShiftTypeTable() {
  const { shiftTypes, loading, error, updateShiftType, setDesired } = useShiftTypes();

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-xl shimmer" />)}
    </div>
  );
  if (error) return <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{error}</div>;

  const sorted = [...shiftTypes].sort((a, b) => (a.shift_id ?? 0) - (b.shift_id ?? 0));
  const desiredCount = sorted.filter(s => s.is_desired).length;

  return (
    <div className="fade-in space-y-4">
      {desiredCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <strong>{desiredCount}</strong> משמרות מסומנות כרצויות — הסולבר יחלק אותן באופן שווה
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">סוגי משמרות</h3>
          <span className="text-xs text-slate-400">לחץ על השם לעריכה</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-right">
                <th className="px-5 py-3 font-semibold text-slate-500 w-14 text-center">#</th>
                <th className="px-5 py-3 font-semibold text-slate-600">שם משמרת</th>
                <th className="px-5 py-3 font-semibold text-slate-600 text-center">קבוצת עמודה</th>
                <th className="px-5 py-3 font-semibold text-amber-600 text-center">רצוי</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((st, idx) => (
                <ShiftTypeRow key={st.id} shiftType={st} idx={idx}
                  onUpdate={updateShiftType} onToggleDesired={setDesired} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ShiftTypeRow({ shiftType, idx, onUpdate, onToggleDesired }: {
  shiftType: ShiftType; idx: number;
  onUpdate: (id: string, data: Partial<Pick<ShiftType, "names">>) => Promise<ShiftType>;
  onToggleDesired: (id: string, value: boolean) => Promise<ShiftType>;
}) {
  const [editName, setEditName] = useState(shiftType.names.join(", "));
  const col = shiftType.csv_column;
  const colorClass = COL_COLORS[(col - 1) % COL_COLORS.length];

  const handleBlur = async () => {
    const t = editName.trim();
    const names = t.split(",").map(n => n.trim()).filter(Boolean);
    if (!names.length || names.join(", ") === shiftType.names.join(", ")) return;
    await onUpdate(shiftType.id, { names });
  };

  return (
    <tr className={`border-b border-slate-50 transition-all duration-150 ${
      shiftType.skip ? "opacity-50" :
      shiftType.is_desired ? "bg-amber-50/60 hover:bg-amber-50" : idx % 2 === 0 ? "hover:bg-slate-50" : "bg-slate-50/40 hover:bg-slate-50"
    }`}>
      <td className="px-5 py-3.5 text-center">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
          {shiftType.shift_id}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <input dir="rtl"
          className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white rounded-lg px-3 py-1.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleBlur}
        />
      </td>
      <td className="px-5 py-3.5 text-center">
        {shiftType.skip ? (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200">לא מתוזמן</span>
        ) : (
          <div className="inline-flex flex-col items-center gap-1">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
              <span>{COL_NAMES[col] ?? `עמודה ${col}`}</span>
              {COL_TO_SHIFTS[col] && (
                <span className="opacity-60">({COL_TO_SHIFTS[col].join(",")})</span>
              )}
            </span>
            {shiftType.friday_only && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-600 border border-orange-200">שישי בלבד</span>
            )}
          </div>
        )}
      </td>
      <td className="px-5 py-3.5 text-center">
        <ToggleSwitch checked={shiftType.is_desired} onChange={() => onToggleDesired(shiftType.id, !shiftType.is_desired)} />
      </td>
    </tr>
  );
}
