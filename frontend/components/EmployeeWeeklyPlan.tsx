"use client";
import { useState } from "react";
import { Search, X } from "lucide-react";
import type { EmployeeWeekPlan, DayStatus } from "@/lib/types";
import { Badge } from "@/components/ui";
import { BADGE_COLORS } from "@/lib/colors";

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
        if (s.type === "cross_dept") {
          return (
            <span key={i} className="text-xs font-medium border rounded px-1.5 py-0.5 leading-tight bg-teal-50 text-teal-700 border-teal-200 flex flex-col gap-0">
              <span>{s.shift_name}</span>
              <span className="text-[10px] opacity-75">מחלקת {s.department}</span>
            </span>
          );
        }
        if (s.type === "oncall") {
          return (
            <span key={i} className="text-xs font-medium border rounded px-1.5 py-0.5 leading-tight bg-purple-50 text-purple-700 border-purple-200">
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

function EmployeeInfoModal({
  emp,
  columnToAttrName,
  onClose,
}: {
  emp: EmployeeWeekPlan;
  columnToAttrName: Record<string, string>;
  onClose: () => void;
}) {
  const attrNames = (emp.attributes ?? [])
    .map(col => columnToAttrName[col])
    .filter(Boolean);

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-xl"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 text-base">{emp.employee_name}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Basic info */}
          <div className="flex flex-col gap-2">
            {emp.home_department && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">מחלקה</span>
                <span className="font-medium text-slate-800">{emp.home_department}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">סטטוס</span>
              <span className={`font-medium ${emp.active ? "text-emerald-600" : "text-slate-400"}`}>
                {emp.active ? "פעיל" : "לא פעיל"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">מקסימום משמרות בשבוע</span>
              <span className="font-medium text-slate-800">{emp.max_shifts_per_week}</span>
            </div>
          </div>

          {/* Attributes */}
          {attrNames.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">תכונות</p>
              <div className="flex flex-wrap gap-1.5">
                {attrNames.map((name, i) => (
                  <Badge key={name} className={BADGE_COLORS[i % BADGE_COLORS.length]}>
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {attrNames.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-1">אין תכונות מוגדרות</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmployeeWeeklyPlan({
  plan,
  weekDays,
  columnToAttrName = {},
}: {
  plan: EmployeeWeekPlan[];
  weekDays: string[];
  columnToAttrName?: Record<string, string>;
}) {
  const [search, setSearch] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<EmployeeWeekPlan | null>(null);

  if (!plan.length) return null;

  const searchLower = search.trim().toLowerCase();
  const filtered = searchLower
    ? plan.filter(e => e.employee_name.toLowerCase().includes(searchLower))
    : plan;

  return (
    <>
      {selectedEmp && (
        <EmployeeInfoModal
          emp={selectedEmp}
          columnToAttrName={columnToAttrName}
          onClose={() => setSelectedEmp(null)}
        />
      )}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" dir="rtl">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-slate-800">תכנון עובדים שבועי</h3>
            <p className="text-xs text-slate-500 mt-0.5">סטטוס כל עובד לכל יום בשבוע</p>
          </div>
          <div className="relative w-52">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש עובד..."
              className="w-full pr-8 pl-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-slate-50"
              dir="rtl"
            />
          </div>
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={weekDays.length + 1} className="px-4 py-6 text-center text-sm text-slate-400">
                    לא נמצאו עובדים התואמים את החיפוש
                  </td>
                </tr>
              ) : (
                filtered.map((emp, idx) => (
                  <tr
                    key={emp.employee_id}
                    className={`border-b border-slate-100 ${!emp.active ? "opacity-50" : ""} ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                  >
                    <td className="px-4 py-3 sticky right-0 bg-inherit z-10">
                      <button
                        onClick={() => setSelectedEmp(emp)}
                        className="text-right hover:text-blue-600 transition-colors group"
                      >
                        <p className={`font-medium text-sm group-hover:text-blue-600 ${emp.active ? "text-slate-800" : "text-slate-400"}`}>
                          {emp.employee_name}
                        </p>
                        {emp.home_department && (
                          <p className="text-xs text-slate-400 mt-0.5">{emp.home_department}</p>
                        )}
                      </button>
                    </td>
                    {weekDays.map(iso => (
                      <td key={iso} className="px-3 py-3 text-center align-top">
                        <StatusCell statuses={emp.days[iso] ?? [{ type: "off" }]} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
