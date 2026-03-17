"use client";
import { useState } from "react";
import type { Schedule, ShiftType, Assignment } from "@/lib/types";

const SHIFT_COLORS = [
  "bg-violet-50 text-violet-800","bg-sky-50 text-sky-800","bg-emerald-50 text-emerald-800",
  "bg-rose-50 text-rose-800","bg-amber-50 text-amber-800","bg-cyan-50 text-cyan-800",
  "bg-pink-50 text-pink-800","bg-indigo-50 text-indigo-800","bg-teal-50 text-teal-800",
  "bg-orange-50 text-orange-800","bg-lime-50 text-lime-800","bg-fuchsia-50 text-fuchsia-800",
  "bg-red-50 text-red-800","bg-blue-50 text-blue-800",
];

// Israeli weekend: Friday=5, Saturday=6
function isWeekend(year: number, month: number, day: number) {
  const d = new Date(year, month - 1, day).getDay();
  return d === 5 || d === 6;
}
function isFriday(year: number, month: number, day: number) {
  return new Date(year, month - 1, day).getDay() === 5;
}

interface Props {
  schedule: Schedule;
  shiftTypes: ShiftType[];
  assignments: Assignment[];
  onAssignmentChange: (day: number, shiftName: string, newEmpName: string) => void;
  changedCells: Set<string>;
}

export default function ScheduleTable({ schedule, shiftTypes, assignments, onAssignmentChange, changedCells }: Props) {
  const [dragSrc, setDragSrc] = useState<{ day: number; shiftName: string; emp: string } | null>(null);
  const [editCell, setEditCell] = useState<{ day: number; shiftName: string } | null>(null);

  if (!schedule.assignments) return null;

  const sorted = [...shiftTypes]
    .sort((a, b) => (a.shift_id ?? 0) - (b.shift_id ?? 0));
  const desiredSet = new Set(sorted.filter(st => st.is_desired).map(st => st.names[0]));

  // Build lookup from the controlled `assignments` prop
  const lookup: Record<number, Record<string, string>> = {};
  for (const a of assignments) {
    if (!lookup[a.day]) lookup[a.day] = {};
    lookup[a.day][a.shift_name] = a.employee_name;
  }

  // Sorted unique employee names from assignments
  const allEmployees = Array.from(new Set(assignments.map(a => a.employee_name))).sort();

  const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto sticky-header" style={{ maxHeight: "600px", overflowY: "auto" }}>
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap sticky top-0 bg-slate-800 w-14 z-20">יום</th>
              {sorted.map((st, i) => (
                <th key={st.id}
                  className={`px-3 py-3 text-center font-semibold whitespace-nowrap sticky top-0 z-10 min-w-[100px] ${
                    desiredSet.has(st.names[0]) ? "bg-amber-700" : "bg-slate-800"
                  }`}>
                  <div className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs mb-1 ${SHIFT_COLORS[i % SHIFT_COLORS.length]}`}>
                    {st.shift_id}
                  </div>
                  <div>{st.names.join(", ")}</div>
                  {desiredSet.has(st.names[0]) && <div className="text-amber-300 text-xs">★</div>}
                  {st.friday_only && <div className="text-slate-400 text-xs">ו׳ בלבד</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const weekend = isWeekend(schedule.year, schedule.month, day);
              return (
                <tr key={day} className={`border-b border-slate-100 transition-colors hover:bg-blue-50/40 ${
                  weekend ? "bg-slate-50" : ""
                }`}>
                  <td className={`px-4 py-2.5 text-center font-bold sticky right-0 z-10 ${
                    weekend ? "bg-slate-100 text-slate-500" : "bg-white text-slate-700"
                  }`}>
                    <div className="text-sm">{day}</div>
                    {weekend && <div className="text-xs text-slate-400">{new Date(schedule.year, schedule.month-1, day).getDay() === 6 ? "שב׳" : "ו׳"}</div>}
                  </td>
                  {sorted.map((st, i) => {
                    const shiftName = st.names[0];
                    const name = lookup[day]?.[shiftName];
                    const fridayOnly = st.friday_only;
                    const dayIsFriday = isFriday(schedule.year, schedule.month, day);
                    const isInactive = fridayOnly && !dayIsFriday;
                    const isChanged = changedCells.has(`${day}-${shiftName}`);
                    const isEditing = editCell?.day === day && editCell?.shiftName === shiftName;
                    const isDragSrc = dragSrc?.day === day && dragSrc?.shiftName === shiftName;

                    if (isInactive) {
                      return (
                        <td key={st.id} className="px-3 py-2.5 text-center bg-slate-50/80">
                          <span className="text-slate-100">—</span>
                        </td>
                      );
                    }

                    if (isEditing) {
                      return (
                        <td key={st.id} className={`px-3 py-2.5 text-center ${
                          isChanged ? "bg-amber-50 ring-1 ring-inset ring-amber-300" :
                          desiredSet.has(shiftName) ? "bg-amber-50/60" : ""
                        }`}>
                          <select
                            autoFocus
                            className="text-xs rounded px-1 py-0.5 border border-blue-400 bg-white text-slate-800 outline-none"
                            defaultValue={name || ""}
                            onChange={e => {
                              onAssignmentChange(day, shiftName, e.target.value);
                              setEditCell(null);
                            }}
                            onBlur={() => setEditCell(null)}
                          >
                            <option value="">—</option>
                            {allEmployees.map(emp => (
                              <option key={emp} value={emp}>{emp}</option>
                            ))}
                          </select>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={st.id}
                        className={`px-3 py-2.5 text-center cursor-pointer transition-all ${
                          isChanged
                            ? "bg-amber-50 ring-1 ring-inset ring-amber-300"
                            : desiredSet.has(shiftName)
                            ? "bg-amber-50/60"
                            : ""
                        } ${isDragSrc ? "opacity-40" : ""}`}
                        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                        onDrop={e => {
                          e.preventDefault();
                          if (!dragSrc) return;
                          const targetEmp = lookup[day]?.[shiftName] ?? "";
                          if (dragSrc.emp !== targetEmp) {
                            onAssignmentChange(dragSrc.day, dragSrc.shiftName, targetEmp);
                            onAssignmentChange(day, shiftName, dragSrc.emp);
                          }
                          setDragSrc(null);
                        }}
                        onClick={() => setEditCell({ day, shiftName })}
                      >
                        {name ? (
                          <span
                            draggable
                            onDragStart={e => {
                              e.stopPropagation();
                              setDragSrc({ day, shiftName, emp: name });
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap cursor-grab active:cursor-grabbing ${SHIFT_COLORS[i % SHIFT_COLORS.length]}`}
                          >
                            {name}
                          </span>
                        ) : (
                          <span className="text-slate-200 text-base">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
