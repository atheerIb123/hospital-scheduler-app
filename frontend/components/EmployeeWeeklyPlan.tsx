"use client";
import type { EmployeeWeekPlan, DayStatus } from "@/lib/types";

const HE_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

const SHIFT_COLORS: Record<string, string> = {
  "משמרת בוקר":  "bg-sky-100 text-sky-700 border-sky-200",
  "משמרת ערב":   "bg-amber-100 text-amber-700 border-amber-200",
  "משמרת לילה":  "bg-violet-100 text-violet-700 border-violet-200",
  "רזרבה":       "bg-emerald-100 text-emerald-700 border-emerald-200",
  "כוננות":      "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function dayLabel(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const dow = HE_DAYS[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dow} ${dd}/${mm}`;
}

function StatusCell({ statuses }: { statuses: DayStatus[] }) {
  if (!statuses.length) return <span className="text-xs text-slate-300">—</span>;

  return (
    <div className="flex flex-col gap-0.5">
      {statuses.map((s, i) => {
        if (s.type === "shift") {
          const color = SHIFT_COLORS[s.shift_name] ?? "bg-slate-100 text-slate-600 border-slate-200";
          return (
            <span key={i} className={`text-xs font-medium border rounded px-1.5 py-0.5 leading-tight ${color}`}>
              {s.shift_name}
            </span>
          );
        }
        if (s.type === "constraint") {
          return (
            <span key={i} className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 leading-tight">
              {s.reason || "חסום"}
            </span>
          );
        }
        return <span key={i} className="text-xs text-slate-300">פנוי</span>;
      })}
    </div>
  );
}

export default function EmployeeWeeklyPlan({
  plan,
  weekDays,
}: {
  plan: EmployeeWeekPlan[];
  weekDays: string[];
}) {
  if (!plan.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" dir="rtl">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800">תכנון עובדים שבועי</h3>
        <p className="text-xs text-slate-500 mt-0.5">סטטוס כל עובד לכל יום בשבוע</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-right font-semibold text-slate-600 w-40 sticky right-0 bg-slate-50 z-10">עובד</th>
              {weekDays.map(iso => (
                <th key={iso} className="px-3 py-3 text-center font-semibold text-slate-600 min-w-[110px]">
                  <span className="block text-xs">{dayLabel(iso)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.map((emp, idx) => (
              <tr
                key={emp.employee_id}
                className={`border-b border-slate-100 ${!emp.active ? "opacity-50" : ""} ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
              >
                <td className="px-4 py-3 sticky right-0 bg-inherit z-10">
                  <p className={`font-medium text-sm ${emp.active ? "text-slate-800" : "text-slate-400"}`}>{emp.employee_name}</p>
                  {emp.home_department && (
                    <p className="text-xs text-slate-400 mt-0.5">{emp.home_department}</p>
                  )}
                </td>
                {weekDays.map(iso => (
                  <td key={iso} className="px-3 py-3 text-center align-top">
                    <StatusCell statuses={emp.days[iso] ?? [{ type: "off" }]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
