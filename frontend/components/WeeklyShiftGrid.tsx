"use client";
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui";
import { AlertTriangle, ChevronDown, Plus, X, Trash2 } from "lucide-react";
import { SHIFT_COLORS_LIGHT as SHIFT_COLORS } from "@/lib/colors";
import type { WeeklyShiftRow, EmployeeWeekPlan } from "@/lib/types";

const HE_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function dayLabel(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const dow = HE_DAYS[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return { dow, date: `${dd}/${mm}` };
}

interface DragSource {
  iso: string;
  shiftName: string;
  empId: string;
  empName: string;
}

interface Props {
  grid: WeeklyShiftRow[];
  weekDays: string[];
  editable?: boolean;
  employees?: EmployeeWeekPlan[];
  changedCells?: Set<string>;
  maxShiftsWarningIds?: Set<string>;
  empShiftCounts?: Record<string, number>;
  onAddEmployee?: (iso: string, shiftName: string, empId: string, empName: string) => void;
  onRemoveEmployee?: (iso: string, shiftName: string, empId: string) => void;
  onMoveEmployee?: (srcIso: string, srcShift: string, srcEmpId: string, srcEmpName: string, tgtIso: string, tgtShift: string) => void;
  shiftLeaderIds?: Set<string>;
}

export default function WeeklyShiftGrid({
  grid,
  weekDays,
  editable = false,
  employees = [],
  changedCells,
  maxShiftsWarningIds,
  empShiftCounts = {},
  onAddEmployee,
  onRemoveEmployee,
  onMoveEmployee,
  shiftLeaderIds,
}: Props) {
  const [selectedCell, setSelectedCell] = useState<{ iso: string; shiftName: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showAtMax, setShowAtMax] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag-and-drop state
  const [dragSrc, setDragSrc] = useState<DragSource | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ iso: string; shiftName: string } | null>(null);

  function openPanel(iso: string, shiftName: string) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setSelectedCell({ iso, shiftName });
    setPanelOpen(true);
    setShowAtMax(false);
  }

  function closePanel() {
    setPanelOpen(false);
    closeTimerRef.current = setTimeout(() => setSelectedCell(null), 200);
  }

  if (!grid.length) return null;

  const empById: Record<string, EmployeeWeekPlan> = {};
  for (const e of employees) empById[e.employee_id] = e;

  const isOverMax = (empId: string) => maxShiftsWarningIds?.has(empId) ?? false;

  function isSameCell(iso: string, shift: string) {
    return dragSrc?.iso === iso && dragSrc?.shiftName === shift;
  }

  function renderPanel() {
    if (!selectedCell) return null;
    const { iso, shiftName } = selectedCell;

    const row = grid.find(r => r.shift_name === shiftName);
    const currentEmps = row?.by_day[iso] ?? [];
    const currentIds = new Set(currentEmps.map(e => e.employee_id));

    const { dow, date } = dayLabel(iso);

    const available = employees.filter(e => e.active && !currentIds.has(e.employee_id));
    const underMax = available.filter(e => (empShiftCounts[e.employee_id] ?? 0) < e.max_shifts_per_week);
    const atMax = available.filter(e => (empShiftCounts[e.employee_id] ?? 0) >= e.max_shifts_per_week);

    return (
      <div dir="rtl">
        <div className="mb-3">
          <h3 className="font-bold text-slate-800 text-base">{dow} {date} — {shiftName}</h3>
          {row?.hours && <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{row.hours}</p>}
        </div>

        {currentEmps.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-500 mb-1.5">משובצים כרגע</p>
            <div className="space-y-1">
              {currentEmps.map(e => {
                const over = isOverMax(e.employee_id);
                return (
                  <div
                    key={e.employee_id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm border ${
                      over
                        ? "bg-red-50 border-red-200 text-red-800"
                        : "bg-blue-50 border-blue-200 text-blue-800"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {e.employee_name}
                      {shiftLeaderIds?.has(e.employee_id) && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded px-0.5 leading-none whitespace-nowrap">א׳&nbsp;משמרת</span>
                      )}
                      {over && <AlertTriangle className="w-3 h-3 text-red-500" />}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs opacity-60">
                        {empShiftCounts[e.employee_id] ?? 0}/{empById[e.employee_id]?.max_shifts_per_week ?? 6}
                      </span>
                      <button
                        onClick={() => {
                          onRemoveEmployee?.(iso, shiftName, e.employee_id);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                        title="הסר"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {currentEmps.length > 0 && available.length > 0 && (
          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">הוסף עובד</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
        )}

        {underMax.length > 0 && (
          <div className="space-y-1 mb-2">
            {underMax.map(e => (
              <button
                key={e.employee_id}
                onClick={() => {
                  onAddEmployee?.(iso, shiftName, e.employee_id, e.employee_name);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-slate-50 text-slate-700 border border-transparent hover:border-slate-200 transition-colors text-right"
              >
                <span className="inline-flex items-center gap-1">{e.employee_name}{shiftLeaderIds?.has(e.employee_id) && (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded px-0.5 leading-none whitespace-nowrap">א׳&nbsp;משמרת</span>
                )}</span>
                <span className="text-xs opacity-60">
                  {empShiftCounts[e.employee_id] ?? 0}/{e.max_shifts_per_week} משמרות
                </span>
              </button>
            ))}
          </div>
        )}

        {atMax.length > 0 && (
          <>
            <Button
              variant="ghost"
              onClick={() => setShowAtMax(!showAtMax)}
              className="w-full flex items-center justify-center gap-1.5 mt-1 py-1.5 text-orange-400 hover:text-orange-600"
              icon={<ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAtMax ? "rotate-180" : ""}`} />}
              iconSide="after"
            >
              {showAtMax ? "הסתר עובדים במקסימום" : `הצג עובדים במקסימום (${atMax.length})`}
            </Button>
            {showAtMax && (
              <div className="space-y-1 mt-1">
                {atMax.map(e => (
                  <button
                    key={e.employee_id}
                    onClick={() => {
                      onAddEmployee?.(iso, shiftName, e.employee_id, e.employee_name);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100 transition-colors text-right"
                  >
                    <span className="inline-flex items-center gap-1">
                      {e.employee_name}
                      {shiftLeaderIds?.has(e.employee_id) && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded px-0.5 leading-none whitespace-nowrap">א׳&nbsp;משמרת</span>
                      )}
                      <AlertTriangle className="w-3 h-3 text-orange-500" />
                    </span>
                    <span className="text-xs opacity-60">
                      {empShiftCounts[e.employee_id] ?? 0}/{e.max_shifts_per_week} משמרות
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {available.length === 0 && currentEmps.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-3">אין עובדים זמינים</p>
        )}
      </div>
    );
  }

  const content = (
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
                const cellKey = `${iso}-${row.shift_name}`;
                const isChanged = changedCells?.has(cellKey);
                const isSelected = selectedCell?.iso === iso && selectedCell?.shiftName === row.shift_name;
                const isDragSource = isSameCell(iso, row.shift_name);
                const isDragOver = dragOverCell?.iso === iso && dragOverCell?.shiftName === row.shift_name;
                const isDragValid = isDragOver && dragSrc && !isSameCell(iso, row.shift_name);

                return (
                  <td
                    key={iso}
                    className={`relative px-3 py-3 text-center align-top transition-all select-none ${
                      editable ? "cursor-pointer hover:bg-blue-50/40" : ""
                    } ${isChanged ? "bg-amber-50 ring-1 ring-inset ring-amber-300" : ""
                    } ${isSelected ? "ring-2 ring-inset ring-blue-400 bg-blue-50/40" : ""
                    } ${isDragSource ? "opacity-40" : ""
                    } ${isDragValid ? "ring-2 ring-inset ring-emerald-400 bg-emerald-50" : ""}`}
                    onClick={editable ? () => openPanel(iso, row.shift_name) : undefined}
                    onDragOver={editable ? (e) => {
                      if (!dragSrc || isSameCell(iso, row.shift_name)) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDragOverCell({ iso, shiftName: row.shift_name });
                    } : undefined}
                    onDragEnter={editable ? () => {
                      if (dragSrc) setDragOverCell({ iso, shiftName: row.shift_name });
                    } : undefined}
                    onDragLeave={editable ? () => setDragOverCell(null) : undefined}
                    onDrop={editable ? (e) => {
                      e.preventDefault();
                      if (!dragSrc || isSameCell(iso, row.shift_name)) return;
                      onMoveEmployee?.(
                        dragSrc.iso, dragSrc.shiftName, dragSrc.empId, dragSrc.empName,
                        iso, row.shift_name,
                      );
                      setDragSrc(null);
                      setDragOverCell(null);
                    } : undefined}
                    onDragEnd={editable ? () => {
                      setDragSrc(null);
                      setDragOverCell(null);
                    } : undefined}
                  >
                    {emps.length === 0 ? (
                      editable ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-slate-300 text-slate-300 hover:border-blue-400 hover:text-blue-400 transition-colors">
                          <Plus className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {(() => {
                          const isReserve = /כוננות|רזרבה/.test(row.shift_name);
                          const cellLeaderId = isReserve ? undefined : emps.find(e => shiftLeaderIds?.has(e.employee_id))?.employee_id;
                          return emps.map((e) => {
                          const over = isOverMax(e.employee_id);
                          const isLeader = e.employee_id === cellLeaderId;
                          return (
                            <span
                              key={e.employee_id}
                              draggable={editable}
                              onDragStart={editable ? (ev) => {
                                ev.stopPropagation();
                                setDragSrc({ iso, shiftName: row.shift_name, empId: e.employee_id, empName: e.employee_name });
                                ev.dataTransfer.effectAllowed = "move";
                              } : undefined}
                              onClick={editable ? (ev) => {
                                ev.stopPropagation();
                                openPanel(iso, row.shift_name);
                              } : undefined}
                              className={`text-xs ${SHIFT_COLORS[idx % SHIFT_COLORS.length]} border rounded px-1.5 py-0.5 leading-tight inline-flex items-center gap-0.5 justify-center ${
                                over ? "ring-1 ring-red-400" : "border-transparent"
                              } ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
                              title={editable ? "גרור להעברה" : undefined}
                            >
                              {e.employee_name}
                              {isLeader && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded px-0.5 leading-none whitespace-nowrap">א׳&nbsp;משמרת</span>
                              )}
                              {over && <AlertTriangle className="w-2.5 h-2.5 text-red-500 shrink-0" />}
                            </span>
                          );
                        });
                        })()}
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
  );

  if (!editable) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" dir="rtl">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">לוח משמרות שבועי</h3>
          <p className="text-xs text-slate-500 mt-0.5">הרכב עובדים לכל משמרת ויום</p>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="flex h-full" dir="rtl">
      <div className="flex-1 min-w-0 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">לוח משמרות שבועי</h3>
          <p className="text-xs text-slate-500 mt-0.5">לחץ על תא כדי לערוך · גרור שם עובד להעברה</p>
        </div>
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
          {content}
        </div>
      </div>

      {/* Side panel */}
      <div
        className="shrink-0 overflow-hidden flex flex-col"
        style={{
          width: panelOpen ? "18rem" : "0",
          marginRight: panelOpen ? "1rem" : "0",
          opacity: panelOpen ? 1 : 0,
          transition: "width 200ms ease-in-out, opacity 150ms ease-in-out, margin-right 200ms ease-in-out",
        }}
      >
        <div className="w-72 h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100">
          {selectedCell && (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
                <p className="text-xs font-semibold text-slate-700 truncate">
                  עריכת שיבוץ
                </p>
                <button
                  onClick={closePanel}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0 mr-2"
                  aria-label="סגור"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                {renderPanel()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
