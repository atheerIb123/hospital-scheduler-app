"use client";
import type { Schedule, ShiftType, Assignment, Employee } from "@/lib/types";
import { SHIFT_COLORS } from "@/lib/colors";

interface Props {
  schedule: Schedule;
  shiftTypes: ShiftType[];
  assignments: Assignment[];
  employees?: Employee[];
}

export default function SummaryTable({ schedule, shiftTypes, assignments, employees = [] }: Props) {
  const inactiveMap = Object.fromEntries(
    employees
      .filter(e => e.active === false)
      .map(e => [e.name, { reason: e.inactive_reason, since: e.inactive_since }])
  );
  if (!schedule.summary) return null;

  const sorted = [...shiftTypes]
    .sort((a, b) => (a.shift_id ?? 0) - (b.shift_id ?? 0));
  const desiredSet = new Set(sorted.filter(st => st.is_desired).map(st => st.names[0]));

  // Compute summary live from current assignments
  const empMap: Record<string, Record<string, number>> = {};
  for (const a of assignments) {
    if (!empMap[a.employee_name]) empMap[a.employee_name] = {};
    empMap[a.employee_name][a.shift_name] = (empMap[a.employee_name][a.shift_name] ?? 0) + 1;
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
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3.5 text-right font-semibold text-slate-600 whitespace-nowrap bg-slate-50">עובד</th>
              {sorted.map((st, i) => (
                <th key={st.id} className={`px-3 py-3.5 text-center font-semibold whitespace-nowrap ${
                  desiredSet.has(st.names[0]) ? "bg-amber-50" : "bg-slate-50"
                }`}>
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${SHIFT_COLORS[i % SHIFT_COLORS.length]}`}>
                    <span>#{st.shift_id}</span>
                    <span>{st.names.join(", ")}</span>
                    {desiredSet.has(st.names[0]) && <span className="text-amber-500">★</span>}
                  </div>
                </th>
              ))}
              <th className="px-5 py-3.5 text-center font-bold text-slate-700 whitespace-nowrap bg-slate-50">סה״כ</th>
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
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      <span className={`font-semibold ${inactiveMap[empName] ? "text-slate-400 line-through" : "text-slate-800"}`}>
                        {empName}
                      </span>
                      {inactiveMap[empName] && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-400 border border-red-100 font-medium">
                            לא פעיל
                            {inactiveMap[empName].since && ` מ-${inactiveMap[empName].since}`}
                          </span>
                          {inactiveMap[empName].reason && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                              {inactiveMap[empName].reason}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
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
