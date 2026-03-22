"use client";
import { useState } from "react";
import type { Schedule, ShiftType, Assignment, Employee, DayType, DaySetting } from "@/lib/types";

const SHIFT_COLORS = [
  "bg-violet-50 text-violet-800","bg-sky-50 text-sky-800","bg-emerald-50 text-emerald-800",
  "bg-rose-50 text-rose-800","bg-amber-50 text-amber-800","bg-cyan-50 text-cyan-800",
  "bg-pink-50 text-pink-800","bg-indigo-50 text-indigo-800","bg-teal-50 text-teal-800",
  "bg-orange-50 text-orange-800","bg-lime-50 text-lime-800","bg-fuchsia-50 text-fuchsia-800",
  "bg-red-50 text-red-800","bg-blue-50 text-blue-800",
];

const HEBREW_MONTH_FORMATTER = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long' });

function toHebrewNumeral(n: number): string {
  const units = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל"];
  if (n === 15) return "טו";
  if (n === 16) return "טז";
  return tens[Math.floor(n / 10)] + units[n % 10];
}

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

type PopupState =
  | { stage: "select"; day: number; shiftName: string }
  | { stage: "resolve"; day: number; shiftName: string; targetEmp: string };

interface Props {
  schedule: Schedule;
  shiftTypes: ShiftType[];
  assignments: Assignment[];
  employees: Employee[];
  onAssignmentChange: (day: number, shiftName: string, newEmpName: string) => void;
  changedCells: Set<string>;
  maxShifts?: number;
  dayTypes: DayType[];
  daySettings: DaySetting[];
  onDayTypeChange: (date: string, day_type_id: string | null) => void;
}

export default function ScheduleTable({
  schedule,
  shiftTypes,
  assignments,
  employees,
  onAssignmentChange,
  changedCells,
  maxShifts = 0,
  dayTypes,
  daySettings,
  onDayTypeChange
}: Props) {
  const [dragSrc, setDragSrc] = useState<{ day: number; shiftName: string; emp: string } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ day: number; shiftName: string } | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);

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

  // Map of date (YYYY-MM-DD) to day type ID
  const dayTypeOverrides: Record<string, string> = {};
  for (const s of daySettings) {
    dayTypeOverrides[s.date] = s.day_type_id;
  }

  function isSwapValid(srcEmp: string, srcShiftName: string, tgtEmp: string, tgtShiftName: string): boolean {
    const srcSt = shiftByName[srcShiftName];
    const tgtSt = shiftByName[tgtShiftName];
    if (!srcSt || !tgtSt) return false;
    if (!canEmployeeDo(srcEmp, tgtSt, employeesByName)) return false;
    if (tgtEmp && !canEmployeeDo(tgtEmp, srcSt, employeesByName)) return false;
    return true;
  }

  // --- Popup rendering ---

  function renderSelectStage(day: number, shiftName: string) {
    const st = shiftByName[shiftName];
    if (!st) return null;
    const currentEmp = lookup[day]?.[shiftName] ?? "";
    const eligibleEmps = employees
      .map(e => e.name)
      .filter(emp => canEmployeeDo(emp, st, employeesByName))
      .sort((a, b) => a.localeCompare(b));

    const underMax = eligibleEmps.filter(emp => maxShifts === 0 || (empShiftCounts[emp] ?? 0) < maxShifts);
    const atMax    = eligibleEmps.filter(emp => maxShifts > 0  && (empShiftCounts[emp] ?? 0) >= maxShifts);

    return (
      <div dir="rtl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-base">יום {day} — {shiftName}</h3>
            {currentEmp && <p className="text-sm text-slate-500 mt-0.5">כרגע: <span className="font-medium text-slate-700">{currentEmp}</span></p>}
          </div>
          <button onClick={() => setPopup(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none mt-0.5">✕</button>
        </div>

        {currentEmp && (
          <button
            onClick={() => { onAssignmentChange(day, shiftName, ""); setPopup(null); }}
            className="w-full text-right px-3 py-2 mb-3 rounded-lg text-sm text-slate-400 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
          >
            — הסר עובד —
          </button>
        )}

        {eligibleEmps.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-4">אין עובדים זכאים למשמרת זו</p>
        )}

        {underMax.length > 0 && (
          <div className="space-y-1 mb-3">
            {underMax.map(emp => {
              const count = empShiftCounts[emp] ?? 0;
              const isCurrent = emp === currentEmp;
              return (
                <button
                  key={emp}
                  onClick={() => {
                    if (!isCurrent) onAssignmentChange(day, shiftName, emp);
                    setPopup(null);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    isCurrent
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "hover:bg-slate-50 text-slate-700 border border-transparent hover:border-slate-200"
                  }`}
                >
                  <span>{emp}{isCurrent ? " ✓" : ""}</span>
                  <span className="text-xs text-slate-400">
                    {count}{maxShifts > 0 ? `/${maxShifts}` : ""} משמרות
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {atMax.length > 0 && (
          <>
            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-orange-100" />
              <span className="text-xs text-orange-400 font-semibold whitespace-nowrap">במקסימום</span>
              <div className="flex-1 h-px bg-orange-100" />
            </div>
            <div className="space-y-1">
              {atMax.map(emp => {
                const count = empShiftCounts[emp] ?? 0;
                return (
                  <button
                    key={emp}
                    onClick={() => setPopup({ stage: "resolve", day, shiftName, targetEmp: emp })}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100 transition-colors"
                  >
                    <span>{emp}</span>
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="text-orange-500 font-semibold">{count}/{maxShifts} ⚠</span>
                      <span className="text-orange-400">בחר אפשרות ›</span>
                    </span>
                  </button>
                );
              })}
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
            onClick={() => setPopup({ stage: "select", day, shiftName })}
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
            onClick={() => {
              onAssignmentChange(day, shiftName, targetEmp);
              setPopup(null);
            }}
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
    if (popup.stage === "select") return renderSelectStage(popup.day, popup.shiftName);
    if (popup.stage === "resolve") return renderResolveStage(popup.day, popup.shiftName, popup.targetEmp);
    return null;
  }

  function DayCellSelector({ day, currentTypeId }: { day: number; currentTypeId?: string }) {
    const [open, setOpen] = useState(false);
    const dateStr = `${schedule.year}-${String(schedule.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const activeType = dayTypes.find(dt => dt.id === currentTypeId);
    const dayOfWeek = new Date(schedule.year, schedule.month-1, day).getDay();
    const dayNames = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
    const dateObj = new Date(schedule.year, schedule.month - 1, day);
    const hMonth = HEBREW_MONTH_FORMATTER.format(dateObj);
    const hDayNum = parseInt(new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric' }).format(dateObj));
    const hebrewDate = `${toHebrewNumeral(hDayNum)} ב${hMonth}`;

    return (
      <div className="relative group/day">
        <div
          onClick={() => setOpen(!open)}
          className={`cursor-pointer p-1 rounded-lg transition-all flex flex-col items-center min-w-[36px] ${
            activeType ? activeType.color : "hover:bg-slate-200/50"
          }`}
        >
          <div className="flex w-full justify-between items-center gap-1 px-0.5">
            <span className="text-sm font-bold">{day}</span>
            <span className="text-[9px] font-medium text-slate-500 whitespace-nowrap">{hebrewDate}</span>
          </div>
          {activeType ? (
            <div className="text-[10px] font-bold uppercase truncate max-w-[40px] leading-tight">
              {activeType.name}
            </div>
          ) : (
            <div className="text-[10px] text-slate-400">
              {dayNames[dayOfWeek]}
            </div>
          )}
        </div>

        {open && (
          <div className="absolute z-50 top-0 right-full mr-2 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 flex flex-col gap-0.5 w-32 animate-in fade-in slide-in-from-right-2">
            <p className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase">סוג יום</p>
            <button
              onClick={() => { onDayTypeChange(dateStr, null); setOpen(false); }}
              className={`w-full text-right px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                !currentTypeId ? "bg-slate-100 border-slate-200 text-slate-700" : "text-slate-500 border-transparent hover:bg-slate-50"
              }`}
            >
              רגיל (ברירת מחדל)
            </button>
            {dayTypes.map((dt) => (
              <button
                key={dt.id}
                onClick={() => { onDayTypeChange(dateStr, dt.id); setOpen(false); }}
                className={`w-full text-right px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  currentTypeId === dt.id ? `${dt.color} shadow-sm border-current` : "text-slate-500 border-transparent hover:bg-slate-50"
                }`}
              >
                {dt.name}
              </button>
            ))}
          </div>
        )}
        {/* Overlay to close */}
        {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto sticky-header" style={{ maxHeight: "600px", overflowY: "auto" }}>
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap sticky top-0 right-0 bg-slate-800 w-14 z-30">יום</th>
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
                    <td className={`px-2 py-2 text-center sticky right-0 z-[5] ${
                      weekend ? "bg-slate-100" : "bg-white"
                    }`}>
                      <DayCellSelector
                        day={day}
                        currentTypeId={dayTypeOverrides[`${schedule.year}-${String(schedule.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`]}
                      />
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
                          onClick={() => setPopup({ stage: "select", day, shiftName })}
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
