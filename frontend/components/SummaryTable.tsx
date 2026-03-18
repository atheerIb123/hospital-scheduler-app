"use client";
import type { Schedule, ShiftType, Assignment } from "@/lib/types";

const SHIFT_COLORS = [
  "bg-violet-100 text-violet-700","bg-sky-100 text-sky-700","bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700","bg-amber-100 text-amber-700","bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700","bg-indigo-100 text-indigo-700","bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700","bg-lime-100 text-lime-700","bg-fuchsia-100 text-fuchsia-700",
  "bg-red-100 text-red-700","bg-blue-100 text-blue-700",
];

interface Props { schedule: Schedule; shiftTypes: ShiftType[]; assignments: Assignment[]; viewMode: "planned" | "actual"; }

export default function SummaryTable({ schedule, shiftTypes, assignments, viewMode }: Props) {
  if (!schedule.summary) return null;

  const sorted = [...shiftTypes]
    .sort((a, b) => (a.shift_id ?? 0) - (b.shift_id ?? 0));
  const desiredSet = new Set(sorted.filter(st => st.is_desired).map(st => st.names[0]));

  // Compute summary live from current assignments
  const empMap: Record<string, Record<string, number>> = {};
  for (const a of assignments) {
    const name = viewMode === "actual" ? (a.actual_employee_name ?? a.employee_name) : a.employee_name;
    if (!empMap[name]) empMap[name] = {};
    empMap[name][a.shift_name] = (empMap[name][a.shift_name] ?? 0) + 1;
  }
  // Preserve original employee order from schedule.summary
  const empNames = schedule.summary.map(s => s.employee_name);

  const colStats: Record<string, { min: number; max: number }> = {};
  for (const st of sorted) {
    const vals = empNames.map(n => empMap[n]?.[st.names[0]] ?? 0);
    colStats[st.names[0]] = { min: Math.min(...vals), max: Math.max(...vals) };
  }
  const totalVals = empNames.map(n => Object.values(empMap[n] ?? {}).reduce((s, v) => s + v, 0));
  const totalStats = { min: Math.min(...totalVals), max: Math.max(...totalVals) };
  const maxTotal = Math.max(...totalVals, 1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3.5 text-right font-semibold text-slate-600 whitespace-nowrap">עובד</th>
              {sorted.map((st, i) => (
                <th key={st.id} className={`px-3 py-3.5 text-center font-semibold whitespace-nowrap ${
                  desiredSet.has(st.names[0]) ? "bg-amber-50" : ""
                }`}>
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${SHIFT_COLORS[i % SHIFT_COLORS.length]}`}>
                    <span>#{st.shift_id}</span>
                    <span>{st.names.join(", ")}</span>
                    {desiredSet.has(st.names[0]) && <span className="text-amber-500">★</span>}
                  </div>
                </th>
              ))}
              <th className="px-5 py-3.5 text-center font-bold text-slate-700 whitespace-nowrap">סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {empNames.map((empName, idx) => {
              const counts = empMap[empName] ?? {};
              const total = Object.values(counts).reduce((s, v) => s + v, 0);
              return (
                <tr key={empName} className={`border-b border-slate-50 transition-colors hover:bg-blue-50/30 ${
                  idx % 2 === 0 ? "" : "bg-slate-50/40"
                }`}>
                  <td className="px-5 py-3 font-semibold text-slate-800 whitespace-nowrap">{empName}</td>
                  {sorted.map((st) => {
                    const key = st.names[0];
                    const val = counts[key] ?? 0;
                    const { min, max } = colStats[key];
                    const isHigh = val === max && min !== max;
                    const isLow = val === min && min !== max;
                    return (
                      <td key={st.id} className={`px-3 py-3 text-center ${desiredSet.has(key) ? "bg-amber-50/60" : ""}`}>
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                          isHigh ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300" :
                          isLow  ? "bg-red-100 text-red-600 ring-2 ring-red-200" :
                          "text-slate-600"
                        }`}>
                          {val}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-5 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-sm font-bold ${
                        total === totalStats.max && totalStats.min !== totalStats.max ? "text-emerald-600" :
                        total === totalStats.min && totalStats.min !== totalStats.max ? "text-red-500" :
                        "text-slate-700"
                      }`}>{total}</span>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all"
                          style={{ width: `${(total / maxTotal) * 100}%` }} />
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
  );
}
