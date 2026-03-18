"use client";
import { useState } from "react";
import type { Schedule, ShiftType, Assignment, Employee } from "@/lib/types";
import { addVolunteer, addShirking } from "@/lib/api";

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

function canEmployeeDo(empName: string, st: ShiftType, byName: Record<string, Employee>): boolean {
  const emp = byName[empName];
  if (!emp) return false;
  if (!st.required_attributes || st.required_attributes.length === 0) return true;
  return st.required_attributes.every(attr => emp.attributes.includes(attr));
}

// Returns the human-readable names of attributes the employee is MISSING for this shift
function getMissingAttrNames(empName: string, st: ShiftType, byName: Record<string, Employee>, columnHeaders: string[]): string[] {
  const emp = byName[empName];
  if (!emp || !st.required_attributes) return [];
  return st.required_attributes
    .filter(attr => !emp.attributes.includes(attr))
    .map(attr => {
      const match = attr.match(/^col_(\d+)$/);
      if (match) {
        const idx = parseInt(match[1]) - 1;
        return columnHeaders[idx] ?? attr;
      }
      return attr;
    });
}

type PopupState =
  | { stage: "select"; day: number; shiftName: string }
  | { stage: "resolve"; day: number; shiftName: string; targetEmp: string };

interface Props {
  schedule: Schedule;
  shiftTypes: ShiftType[];
  assignments: Assignment[];
  employees: Employee[];
  columnHeaders: string[];          // e.g. ["מיון 1","כוננות מחלקה",…] index 0 = col_1
  onAssignmentChange: (day: number, shiftName: string, newEmpName: string) => void;
  changedCells: Set<string>;
  maxShifts?: number;
}

export default function ScheduleTable({ schedule, shiftTypes, assignments, employees, columnHeaders, onAssignmentChange, changedCells, maxShifts = 0 }: Props) {
  const [dragSrc, setDragSrc] = useState<{ day: number; shiftName: string; emp: string } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ day: number; shiftName: string } | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [showIneligible, setShowIneligible] = useState(false);
  const [flagVolunteer, setFlagVolunteer] = useState(false);
  const [flagShirking, setFlagShirking] = useState(false);

  function openSelectPopup(day: number, shiftName: string) {
    setPopup({ stage: "select", day, shiftName });
    setShowIneligible(false);
    setFlagVolunteer(false);
    setFlagShirking(false);
  }

  async function assignEmployee(day: number, shiftName: string, newEmpName: string, currentEmpName: string) {
    onAssignmentChange(day, shiftName, newEmpName);
    const empObj = employees.find(e => e.name === newEmpName);
    const shiftType = shiftByName[shiftName];
    if (flagVolunteer && empObj) {
      try {
        await addVolunteer({
          employee_id:   empObj.id,
          employee_name: newEmpName,
          shift_type_id: shiftType?.id ?? "",
          shift_name:    shiftName,
          day,
          month:  schedule.month,
          year:   schedule.year,
        });
      } catch { /* non-blocking */ }
    }
    if (flagShirking && currentEmpName) {
      const oldEmp = employees.find(e => e.name === currentEmpName);
      try {
        await addShirking({
          employee_id:      oldEmp?.id ?? "",
          employee_name:    currentEmpName,
          shift_name:       shiftName,
          day,
          month:            schedule.month,
          year:             schedule.year,
          replacement_name: newEmpName,
        });
      } catch { /* non-blocking */ }
    }
    setPopup(null);
  }

  if (!schedule.assignments) return null;

  const sorted = [...shiftTypes].sort((a, b) => (a.shift_id ?? 0) - (b.shift_id ?? 0));
  const desiredSet = new Set(sorted.filter(st => st.is_desired).map(st => st.names[0]));

  const lookup: Record<number, Record<string, string>> = {};
  for (const a of assignments) {
    if (!lookup[a.day]) lookup[a.day] = {};
    lookup[a.day][a.shift_name] = a.employee_name;
  }

  const employeesByName: Record<string, Employee> = {};
  for (const emp of employees) {
    employeesByName[emp.name] = emp;
  }

  const shiftByName: Record<string, ShiftType> = {};
  for (const st of sorted) {
    shiftByName[st.names[0]] = st;
  }

  // Compute per-employee shift counts
  const empShiftCounts: Record<string, number> = {};
  for (const a of assignments) {
    if (a.employee_name) {
      empShiftCounts[a.employee_name] = (empShiftCounts[a.employee_name] ?? 0) + 1;
    }
  }

  const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function isSwapValid(srcEmp: string, srcShiftName: string, tgtEmp: string, tgtShiftName: string): boolean {
    const srcSt = shiftByName[srcShiftName];
    const tgtSt = shiftByName[tgtShiftName];
    if (!srcSt || !tgtSt) return false;
    if (!canEmployeeDo(srcEmp, tgtSt, employeesByName)) return false;
    if (tgtEmp && !canEmployeeDo(tgtEmp, srcSt, employeesByName)) return false;
    return true;
  }

  // --- Popup rendering ---

  function renderSelectStage(day: number, shiftName: string, showIneligible: boolean, setShowIneligible: (v: boolean) => void) {
    const st = shiftByName[shiftName];
    if (!st) return null;
    const currentEmp = lookup[day]?.[shiftName] ?? "";

    const allNames = employees.map(e => e.name).sort((a, b) => a.localeCompare(b));
    const eligibleEmps   = allNames.filter(emp => canEmployeeDo(emp, st, employeesByName));
    const ineligibleEmps = allNames.filter(emp => !canEmployeeDo(emp, st, employeesByName));

    const underMax = eligibleEmps.filter(emp => maxShifts === 0 || (empShiftCounts[emp] ?? 0) < maxShifts);
    const atMax    = eligibleEmps.filter(emp => maxShifts > 0  && (empShiftCounts[emp] ?? 0) >= maxShifts);

    function EmpRow({ emp, className, warn }: { emp: string; className: string; warn?: string }) {
      const count = empShiftCounts[emp] ?? 0;
      const isCurrent = emp === currentEmp;
      const missing = getMissingAttrNames(emp, st!, employeesByName, columnHeaders);
      return (
        <div className="space-y-0.5">
          <div className={`flex items-center gap-1 ${className}`}>
            <button
              onClick={() => { if (!isCurrent) assignEmployee(day, shiftName, emp, currentEmp); else setPopup(null); }}
              className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-right"
            >
              <span>{emp}{isCurrent ? " ✓" : ""}</span>
              <span className="text-xs opacity-60">{count}{maxShifts > 0 ? `/${maxShifts}` : ""} משמרות{warn ? ` ${warn}` : ""}</span>
            </button>
            {!isCurrent && emp !== "" && (
              <button
                onClick={() => setPopup({ stage: "resolve", day, shiftName, targetEmp: emp })}
                className="px-2 py-2 rounded-lg text-xs bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200 transition-colors whitespace-nowrap shrink-0"
                title="אפשרויות החלפה"
              >↔</button>
            )}
          </div>
          {missing.length > 0 && (
            <p className="text-[10px] text-red-400 pr-3 pb-0.5">חסר: {missing.join(", ")}</p>
          )}
        </div>
      );
    }

    return (
      <div dir="rtl">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base">יום {day} — {shiftName}</h3>
            {currentEmp && <p className="text-sm text-slate-500 mt-0.5">כרגע: <span className="font-medium text-slate-700">{currentEmp}</span></p>}
          </div>
          <button onClick={() => setPopup(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none mt-0.5">✕</button>
        </div>

        {/* Flags */}
        <div className="flex flex-col gap-1.5 mb-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 select-none">
            <input type="checkbox" checked={flagVolunteer} onChange={e => setFlagVolunteer(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500" />
            <span>🤝 סמן כהתנדבות של העובד החדש</span>
          </label>
          {currentEmp && (
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 select-none">
              <input type="checkbox" checked={flagShirking} onChange={e => setFlagShirking(e.target.checked)}
                className="w-4 h-4 rounded accent-red-400" />
              <span>🚫 סמן הברזה של <strong>{currentEmp}</strong></span>
            </label>
          )}
        </div>

        {currentEmp && (
          <button
            onClick={() => { onAssignmentChange(day, shiftName, ""); setPopup(null); }}
            className="w-full text-right px-3 py-2 mb-3 rounded-lg text-sm text-slate-400 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
          >— הסר עובד —</button>
        )}

        {/* Eligible — under max */}
        {underMax.length > 0 && (
          <div className="space-y-1 mb-2">
            {underMax.map(emp => (
              <EmpRow key={emp} emp={emp}
                className={emp === currentEmp
                  ? "bg-blue-50 text-blue-700 border border-blue-200 rounded-lg"
                  : "hover:bg-slate-50 text-slate-700 border border-transparent hover:border-slate-200 rounded-lg"
                }
              />
            ))}
          </div>
        )}

        {/* Eligible — at/over max */}
        {atMax.length > 0 && (
          <>
            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-orange-100" />
              <span className="text-xs text-orange-400 font-semibold whitespace-nowrap">במקסימום משמרות</span>
              <div className="flex-1 h-px bg-orange-100" />
            </div>
            <div className="space-y-1 mb-2">
              {atMax.map(emp => (
                <EmpRow key={emp} emp={emp}
                  className="bg-orange-50 text-orange-800 border border-orange-200 rounded-lg hover:bg-orange-100"
                  warn="⚠"
                />
              ))}
            </div>
          </>
        )}

        {eligibleEmps.length === 0 && !showIneligible && (
          <p className="text-slate-400 text-sm text-center py-3">אין עובדים מתאימים למשמרת זו</p>
        )}

        {/* Toggle ineligible */}
        {ineligibleEmps.length > 0 && (
          <button type="button" onClick={() => setShowIneligible(!showIneligible)}
            className="w-full flex items-center justify-center gap-1.5 mt-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 transition-transform ${showIneligible ? "rotate-180" : ""}`}>
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
            </svg>
            {showIneligible ? "הסתר לא מתאימים" : `הצג לא מתאימים (${ineligibleEmps.length})`}
          </button>
        )}

        {/* Ineligible employees */}
        {showIneligible && ineligibleEmps.length > 0 && (
          <>
            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-red-100" />
              <span className="text-xs text-red-400 font-semibold whitespace-nowrap">לא עומדים בדרישות</span>
              <div className="flex-1 h-px bg-red-100" />
            </div>
            <div className="space-y-1">
              {ineligibleEmps.map(emp => (
                <EmpRow key={emp} emp={emp}
                  className="bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100"
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderResolveStage(day: number, shiftName: string, targetEmp: string) {
    const currentEmp = lookup[day]?.[shiftName] ?? "";
    const targetCount = empShiftCounts[targetEmp] ?? 0;

    // targetEmp's other assignments (excluding the target cell itself)
    const targetAssignments = assignments.filter(a =>
      a.employee_name === targetEmp && !(a.day === day && a.shift_name === shiftName)
    ).sort((a, b) => a.day - b.day);

    // Splits: shifts where currentEmp can work (valid swap) vs not
    const validSwaps = currentEmp
      ? targetAssignments.filter(a => {
          const st = shiftByName[a.shift_name];
          return st ? canEmployeeDo(currentEmp, st, employeesByName) : false;
        })
      : [];
    const invalidSwaps = targetAssignments.filter(a => !validSwaps.includes(a));

    return (
      <div dir="rtl">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => openSelectPopup(day, shiftName)}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            ‹ חזור
          </button>
          <button onClick={() => setPopup(null)} className="mr-auto text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-5">
          <p className="text-orange-800 font-semibold">{targetEmp}</p>
          <p className="text-orange-600 text-sm mt-0.5">
            כבר ב־{targetCount} משמרות מתוך {maxShifts} מותרות
          </p>
        </div>

        {/* Option 1: swap with one of targetEmp's existing shifts */}
        {currentEmp && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              החלף עם משמרת קיימת
            </p>
            <p className="text-xs text-slate-400 mb-2">
              {currentEmp} יעבור למשמרת הנבחרת — ספירת המשמרות תישאר זהה לשני הצדדים
            </p>
            {validSwaps.length === 0 && (
              <p className="text-xs text-slate-400 italic">
                אין משמרות של {targetEmp} שמתאימות ל{currentEmp}
              </p>
            )}
            <div className="space-y-1">
              {validSwaps.map(a => (
                <button
                  key={`${a.day}-${a.shift_name}`}
                  onClick={() => {
                    onAssignmentChange(day, shiftName, targetEmp);
                    onAssignmentChange(a.day, a.shift_name, currentEmp);
                    setPopup(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  <span>יום {a.day} — {a.shift_name}</span>
                  <span className="text-xs text-emerald-600 font-medium">החלף ↔</span>
                </button>
              ))}
              {invalidSwaps.map(a => (
                <div
                  key={`${a.day}-${a.shift_name}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-slate-50 text-slate-400 border border-slate-100"
                >
                  <span>יום {a.day} — {a.shift_name}</span>
                  <span className="text-xs">{currentEmp} לא זכאי</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Option 2: override max */}
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">חריגה מהמקסימום</p>
          <button
            onClick={() => assignEmployee(day, shiftName, targetEmp, currentEmp)}
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors font-medium"
          >
            הקצה בכל זאת — {targetEmp} יגיע ל־{targetCount + 1} משמרות ⚠
          </button>
        </div>
      </div>
    );
  }

  function renderPopupContent() {
    if (!popup) return null;
    if (popup.stage === "select") return renderSelectStage(popup.day, popup.shiftName, showIneligible, setShowIneligible);
    return renderResolveStage(popup.day, popup.shiftName, popup.targetEmp);
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto sticky-header" style={{ maxHeight: "600px", overflowY: "auto" }}>
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap sticky top-0 bg-slate-800 w-14 z-20">יום</th>
                {sorted.map((st, i) => (
                  <th key={st.id}
                    className={`px-3 py-3 text-center font-semibold whitespace-nowrap sticky top-0 z-10 min-w-25 ${
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
                      const isDragSrc = dragSrc?.day === day && dragSrc?.shiftName === shiftName;
                      const isDragOver = dragOverCell?.day === day && dragOverCell?.shiftName === shiftName;
                      const dragValid = dragSrc && isDragOver
                        ? isSwapValid(dragSrc.emp, dragSrc.shiftName, lookup[day]?.[shiftName] ?? "", shiftName)
                        : null;

                      // Warn if employee is over max
                      const isOverMax = maxShifts > 0 && name && (empShiftCounts[name] ?? 0) > maxShifts;

                      if (isInactive) {
                        return (
                          <td key={st.id} className="px-3 py-2.5 text-center bg-slate-50/80">
                            <span className="text-slate-100">—</span>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={st.id}
                          className={`relative px-3 py-2.5 text-center transition-all select-none cursor-pointer ${
                            isChanged
                              ? "bg-amber-50 ring-1 ring-inset ring-amber-300"
                              : desiredSet.has(shiftName)
                              ? "bg-amber-50/60"
                              : ""
                          } ${isDragSrc ? "opacity-40" : ""} ${
                            isDragOver && dragValid === true
                              ? "ring-2 ring-inset ring-emerald-400 bg-emerald-50"
                              : isDragOver && dragValid === false
                              ? "ring-2 ring-inset ring-red-400 bg-red-50"
                              : ""
                          }`}
                          onClick={() => openSelectPopup(day, shiftName)}
                          onDragEnd={() => { setDragSrc(null); setDragOverCell(null); }}
                          onDragOver={e => {
                            if (!dragSrc) return;
                            const tgtEmp = lookup[day]?.[shiftName] ?? "";
                            if (isSwapValid(dragSrc.emp, dragSrc.shiftName, tgtEmp, shiftName)) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                            }
                            setDragOverCell({ day, shiftName });
                          }}
                          onDragEnter={() => setDragOverCell({ day, shiftName })}
                          onDragLeave={() => setDragOverCell(null)}
                          onDrop={e => {
                            e.preventDefault();
                            if (!dragSrc) return;
                            const targetEmp = lookup[day]?.[shiftName] ?? "";
                            if (isSwapValid(dragSrc.emp, dragSrc.shiftName, targetEmp, shiftName)) {
                              if (dragSrc.emp !== targetEmp) {
                                onAssignmentChange(dragSrc.day, dragSrc.shiftName, targetEmp);
                                onAssignmentChange(day, shiftName, dragSrc.emp);
                              }
                            }
                            setDragSrc(null);
                            setDragOverCell(null);
                          }}
                        >
                          {/* Drag handle */}
                          {name && (
                            <span
                              draggable
                              onDragStart={e => {
                                e.stopPropagation();
                                setDragSrc({ day, shiftName, emp: name });
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={e => e.stopPropagation()}
                              className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded text-slate-300 hover:text-slate-500 hover:bg-slate-200/70 transition-colors text-[10px] leading-none cursor-grab active:cursor-grabbing"
                              title="גרור להחלפה"
                            >
                              ⠿
                            </span>
                          )}

                          {name ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${SHIFT_COLORS[i % SHIFT_COLORS.length]} ${isOverMax ? "ring-1 ring-red-400" : ""}`}>
                              {name}{isOverMax ? " ⚠" : ""}
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

      {/* Popup overlay */}
      {popup && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setPopup(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-100 w-80 max-h-[80vh] overflow-y-auto p-5"
            onClick={e => e.stopPropagation()}
          >
            {renderPopupContent()}
          </div>
        </div>
      )}
    </>
  );
}
