"use client";
import type { WeeklyShiftRow } from "@/lib/types";

const HE_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function dayLabel(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const dow = HE_DAYS[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return { dow, date: `${dd}/${mm}` };
}

export default function WeeklyShiftGrid({
  grid,
  weekDays,
}: {
  grid: WeeklyShiftRow[];
  weekDays: string[];
}) {
  if (!grid.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" dir="rtl">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800">לוח משמרות שבועי</h3>
        <p className="text-xs text-slate-500 mt-0.5">הרכב עובדים לכל משמרת ויום</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-right font-semibold text-slate-600 w-36">משמרת</th>
              {weekDays.map(iso => {
                const { dow, date } = dayLabel(iso);
                return (
                  <th key={iso} className="px-3 py-3 text-center font-semibold text-slate-600 min-w-[110px]">
                    <span className="block text-sm">{dow}</span>
                    <span className="block text-xs font-normal text-slate-400">{date}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, idx) => (
              <tr key={row.shift_name} className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800 text-sm">{row.shift_name}</p>
                  {row.hours && <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{row.hours}</p>}
                </td>
                {weekDays.map(iso => {
                  const emps = row.by_day[iso] ?? [];
                  return (
                    <td key={iso} className="px-3 py-3 text-center align-top">
                      {emps.length === 0 ? (
                        <span className="text-xs text-slate-300">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {emps.map((e, i) => (
                            <span key={i} className="text-xs text-slate-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 leading-tight">
                              {e.employee_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
