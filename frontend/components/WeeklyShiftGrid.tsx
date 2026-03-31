"use client";
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui";
import { AlertTriangle, ChevronDown, Plus, X, Trash2, Search } from "lucide-react";
import { SHIFT_COLORS_LIGHT as SHIFT_COLORS } from "@/lib/colors";
import type { WeeklyShiftRow, EmployeeWeekPlan, ShiftConfig } from "@/lib/types";

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
  /** Full roster for the replacement picker (all depts). Falls back to employees. */
  replacePickerEmployees?: EmployeeWeekPlan[];
  changedCells?: Set<string>;
  maxShiftsWarningIds?: Set<string>;
  empShiftCounts?: Record<string, number>;
  onAddEmployee?: (iso: string, shiftName: string, empId: string, empName: string, roleSlot?: string) => void;
  onRemoveEmployee?: (iso: string, shiftName: string, empId: string) => void;
  onMoveEmployee?: (srcIso: string, srcShift: string, srcEmpId: string, srcEmpName: string, tgtIso: string, tgtShift: string) => void;
  shiftLeaderIds?: Set<string>;
  shiftComposition?: Record<string, ShiftConfig>;
  columnToAttrName?: Record<string, string>;
}

export default function WeeklyShiftGrid({
  grid,
  weekDays,
  editable = false,
  employees = [],
  replacePickerEmployees,
  changedCells,
  maxShiftsWarningIds,
  empShiftCounts = {},
  onAddEmployee,
  onRemoveEmployee,
  onMoveEmployee,
  shiftLeaderIds,
  shiftComposition,
  columnToAttrName,
}: Props) {
  const [selectedCell, setSelectedCell] = useState<{ iso: string; shiftName: string; roleSlot?: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showAtMax, setShowAtMax] = useState(false);
  const [showIneligible, setShowIneligible] = useState(false);
  const [panelRole, setPanelRole] = useState("");
  const [panelSearch, setPanelSearch] = useState("");
  const [panelDept, setPanelDept] = useState("");
  const [replaceEmp, setReplaceEmp] = useState<{ id: string; name: string } | null>(null);
  const [gridSearch, setGridSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["sd-ok"]));
  const [replaceDeptFilter, setReplaceDeptFilter] = useState("");
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag-and-drop state
  const [dragSrc, setDragSrc] = useState<DragSource | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ iso: string; shiftName: string } | null>(null);

  /** Infer which role_slot an employee fills in a shift based on their attributes. */
  function inferRoleSlot(empId: string, shiftName: string): string {
    const emp = empById[empId];
    if (!emp?.attributes?.length || !shiftComposition || !columnToAttrName) return "";
    const slots = shiftComposition[shiftName]?.role_slots ?? [];
    for (const slot of slots) {
      const colKey = Object.entries(columnToAttrName).find(([, n]) => n === slot.attribute_name)?.[0];
      if (colKey && emp.attributes.includes(colKey)) return slot.attribute_name;
    }
    return "";
  }

  function openPanel(iso: string, shiftName: string, roleSlot?: string, replace?: { id: string; name: string }, overridePanelRole?: string) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setSelectedCell({ iso, shiftName, roleSlot });
    setPanelOpen(true);
    setShowAtMax(false);
    setShowIneligible(false);
    setPanelSearch("");
    setPanelDept("");
    setPanelRole(overridePanelRole ?? roleSlot ?? "");
    setReplaceEmp(replace ?? null);
    setExpandedGroups(new Set(["sd-ok"]));
    setReplaceDeptFilter("");
  }

  function closePanel() {
    setPanelOpen(false);
    closeTimerRef.current = setTimeout(() => setSelectedCell(null), 200);
  }

  if (!grid.length) return null;

  const empById: Record<string, EmployeeWeekPlan> = {};
  // employees (schedule.employee_plan) may lack attributes on old schedules — load first
  for (const e of employees) empById[e.employee_id] = e;
  // replacePickerEmployees (raw Employee data) always has attributes — overwrite to preserve them
  for (const e of (replacePickerEmployees ?? [])) empById[e.employee_id] = e;

  // Unique departments from the employee list (for the dept filter dropdown)
  const deptOptions = Array.from(new Set(employees.map(e => e.home_department).filter(Boolean))).sort();

  const isOverMax = (empId: string) => maxShiftsWarningIds?.has(empId) ?? false;

  function isSameCell(iso: string, shift: string) {
    return dragSrc?.iso === iso && dragSrc?.shiftName === shift;
  }

  function renderPanel() {
    if (!selectedCell) return null;
    const { iso, shiftName, roleSlot: cellRoleSlot } = selectedCell;

    // Match the exact row: when role-slot rows exist, match by role_slot too
    const row = cellRoleSlot
      ? grid.find(r => r.shift_name === shiftName && r.role_slot === cellRoleSlot)
      : grid.find(r => r.shift_name === shiftName && !r.role_slot);
    const currentEmps = row?.by_day[iso] ?? [];
    const currentIds = new Set(currentEmps.map(e => e.employee_id));

    const { dow, date } = dayLabel(iso);

    const searchLower = panelSearch.trim().toLowerCase();
    const roleSlots = shiftComposition?.[shiftName]?.role_slots ?? [];
    const freeSlotRow = grid.find(r => r.shift_name === shiftName && r.role_slot === "__free__");
    const freeSlotCount = freeSlotRow?.slot_count ?? 0;
    // Resolve selected role's col_key for eligibility filtering (__free__ won't match → no filter)
    const panelRoleColKey = panelRole && panelRole !== "__free__" && columnToAttrName
      ? Object.entries(columnToAttrName).find(([, name]) => name === panelRole)?.[0]
      : undefined;
    const basePool = employees.filter(e =>
      e.active &&
      !currentIds.has(e.employee_id) &&
      (!searchLower || e.employee_name.toLowerCase().includes(searchLower)) &&
      (!panelDept || e.home_department === panelDept),
    );
    const available = basePool.filter(e => !panelRoleColKey || e.attributes?.includes(panelRoleColKey));
    const ineligible = panelRoleColKey ? basePool.filter(e => !e.attributes?.includes(panelRoleColKey)) : [];
    const underMax = available.filter(e => (empShiftCounts[e.employee_id] ?? 0) < e.max_shifts_per_week);
    const atMax = available.filter(e => (empShiftCounts[e.employee_id] ?? 0) >= e.max_shifts_per_week);

    const handleSelectEmployee = (empId: string, empName: string) => {
      if (replaceEmp) {
        onRemoveEmployee?.(iso, shiftName, replaceEmp.id);
        setReplaceEmp(null);
      }
      onAddEmployee?.(iso, shiftName, empId, empName, panelRole || undefined);
    };

    return (
      <div dir="rtl">
        <div className="mb-3">
          <h3 className="font-bold text-slate-800 text-base">{dow} {date} — {shiftName}</h3>
          {row?.hours && <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{row.hours}</p>}
        </div>

        {replaceEmp && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2">
            <span className="text-xs text-amber-700 font-medium">מחליף: {replaceEmp.name}</span>
            <button
              type="button"
              onClick={() => setReplaceEmp(null)}
              className="text-amber-400 hover:text-amber-600 transition-colors"
              title="בטל החלפה"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Role slot selector */}
        {roleSlots.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-500 mb-1.5">תפקיד</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setPanelRole("")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  panelRole === ""
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                }`}
              >
                כולם
              </button>
              {roleSlots.map(slot => {
                const filledCount = currentEmps.filter(e => {
                  if (!columnToAttrName) return false;
                  const colKey = Object.entries(columnToAttrName).find(([, n]) => n === slot.attribute_name)?.[0];
                  const empPlan = empById[e.employee_id];
                  return colKey && empPlan?.attributes?.includes(colKey);
                }).length;
                const isActive = panelRole === slot.attribute_name;
                return (
                  <button
                    key={slot.attribute_name}
                    type="button"
                    onClick={() => setPanelRole(isActive ? "" : slot.attribute_name)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    {slot.attribute_name}
                    <span className="mr-1 opacity-60">{filledCount}/{slot.count}</span>
                  </button>
                );
              })}
              {freeSlotCount > 0 && (
                <button
                  type="button"
                  onClick={() => setPanelRole(panelRole === "__free__" ? "" : "__free__")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    panelRole === "__free__"
                      ? "bg-slate-600 text-white border-slate-600"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  ללא תפקיד ספציפי
                  <span className="mr-1 opacity-60">{freeSlotRow?.by_day[iso]?.length ?? 0}/{freeSlotCount}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search + dept filter */}
        <div className="flex flex-col gap-2 mb-3">
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={panelSearch}
              onChange={e => setPanelSearch(e.target.value)}
              placeholder="חיפוש לפי שם..."
              className="w-full pr-8 pl-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-slate-50"
              dir="rtl"
            />
          </div>
          {!replaceEmp && deptOptions.length > 1 && (
            <select
              value={panelDept}
              onChange={e => setPanelDept(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-slate-50"
              dir="rtl"
            >
              <option value="">כל המחלקות</option>
              {deptOptions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
        </div>

        {/* Currently assigned employees */}
        {currentEmps.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-500 mb-1.5">משובצים כרגע</p>
            <div className="space-y-1">
              {currentEmps.map(e => {
                const over = isOverMax(e.employee_id);
                const isBeingReplaced = replaceEmp?.id === e.employee_id;
                return (
                  <div
                    key={e.employee_id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm border ${
                      isBeingReplaced
                        ? "bg-amber-50 border-amber-300 text-amber-800"
                        : over
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
                        onClick={() => onRemoveEmployee?.(iso, shiftName, e.employee_id)}
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

        {/* ── Replace mode: 4 grouped sections ── */}
        {replaceEmp ? (() => {
          const replacedEmpDept = empById[replaceEmp.id]?.home_department ?? "";
          const ineligibilityReason = panelRole ? `חסר תפקיד: ${panelRole}` : "";
          const isEligible = (e: EmployeeWeekPlan) => !panelRoleColKey || !!e.attributes?.includes(panelRoleColKey);
          const pickerPool = replacePickerEmployees ?? employees;
          const candidatesBase = pickerPool.filter(e =>
            e.active &&
            !currentIds.has(e.employee_id) &&
            (!searchLower || e.employee_name.toLowerCase().includes(searchLower)),
          );

          const otherDeptOptions = Array.from(
            new Set(candidatesBase.filter(e => e.home_department !== replacedEmpDept).map(e => e.home_department).filter(Boolean))
          ).sort();

          const groups: { key: string; label: string; eligible: boolean; emps: EmployeeWeekPlan[]; reason: string; isOtherDept?: boolean }[] = [
            {
              key: "sd-ok",
              label: `מתאימים — ${replacedEmpDept || "המחלקה"}`,
              eligible: true,
              emps: candidatesBase.filter(e => e.home_department === replacedEmpDept && isEligible(e)),
              reason: "",
            },
            {
              key: "sd-no",
              label: `לא מתאימים — ${replacedEmpDept || "המחלקה"}`,
              eligible: false,
              emps: candidatesBase.filter(e => e.home_department === replacedEmpDept && !isEligible(e)),
              reason: ineligibilityReason,
            },
            {
              key: "od-ok",
              label: "מתאימים — מחלקות אחרות",
              eligible: true,
              isOtherDept: true,
              emps: candidatesBase.filter(e =>
                e.home_department !== replacedEmpDept && isEligible(e) &&
                (!replaceDeptFilter || e.home_department === replaceDeptFilter)
              ),
              reason: "",
            },
            {
              key: "od-no",
              label: "לא מתאימים — מחלקות אחרות",
              eligible: false,
              isOtherDept: true,
              emps: candidatesBase.filter(e =>
                e.home_department !== replacedEmpDept && !isEligible(e) &&
                (!replaceDeptFilter || e.home_department === replaceDeptFilter)
              ),
              reason: ineligibilityReason,
            },
          ];

          const toggleGroup = (key: string) => {
            setExpandedGroups(prev => {
              const next = new Set(prev);
              next.has(key) ? next.delete(key) : next.add(key);
              return next;
            });
          };

          const renderEmpButton = (e: EmployeeWeekPlan, reason: string) => {
            const over = isOverMax(e.employee_id);
            return (
              <button
                key={e.employee_id}
                onClick={() => handleSelectEmployee(e.employee_id, e.employee_name)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-slate-50 text-slate-700 border border-transparent hover:border-slate-200 transition-colors text-right"
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span className="inline-flex items-center gap-1">
                    {e.employee_name}
                    {shiftLeaderIds?.has(e.employee_id) && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded px-0.5 leading-none whitespace-nowrap">א׳&nbsp;משמרת</span>
                    )}
                  </span>
                  {reason && (
                    <span className="text-[10px] text-rose-500 font-medium">{reason}</span>
                  )}
                  {e.home_department && (
                    <span className="text-[10px] text-slate-400">{e.home_department}</span>
                  )}
                </span>
                <span className={`text-xs shrink-0 flex items-center gap-1 ${over ? "text-orange-500" : "opacity-50"}`}>
                  {over && <AlertTriangle className="w-3 h-3" />}
                  {empShiftCounts[e.employee_id] ?? 0}/{e.max_shifts_per_week}
                </span>
              </button>
            );
          };

          // Unfiltered counts for other-dept groups (for the badge)
          const odOkTotal = candidatesBase.filter(e => e.home_department !== replacedEmpDept && isEligible(e)).length;
          const odNoTotal = candidatesBase.filter(e => e.home_department !== replacedEmpDept && !isEligible(e)).length;
          const odTotals: Record<string, number> = { "od-ok": odOkTotal, "od-no": odNoTotal };

          const total = candidatesBase.length;
          return (
            <div className="space-y-1">
              {total === 0 && (
                <p className="text-slate-400 text-sm text-center py-3">לא נמצאו עובדים</p>
              )}
              {otherDeptOptions.length > 1 && (
                <select
                  value={replaceDeptFilter}
                  onChange={e => setReplaceDeptFilter(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-slate-50 text-slate-600"
                  dir="rtl"
                >
                  <option value="">כל המחלקות האחרות</option>
                  {otherDeptOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              {groups.map(g => {
                const expanded = expandedGroups.has(g.key);
                const displayCount = g.isOtherDept ? (odTotals[g.key] ?? g.emps.length) : g.emps.length;
                const isEmpty = displayCount === 0;
                return (
                  <div key={g.key} className={`border rounded-xl overflow-hidden ${isEmpty ? "border-slate-100" : "border-slate-200"}`}>
                    <button
                      type="button"
                      onClick={() => !isEmpty && toggleGroup(g.key)}
                      disabled={isEmpty}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors ${
                        isEmpty
                          ? "bg-slate-50/40 text-slate-300 cursor-default"
                          : g.eligible
                          ? "bg-slate-50 hover:bg-slate-100 text-slate-700"
                          : "bg-slate-50/60 hover:bg-slate-100 text-slate-500"
                      }`}
                    >
                      <span>{g.label}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isEmpty ? "bg-slate-100 text-slate-300" : g.eligible ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"
                        }`}>{displayCount}</span>
                        {!isEmpty && <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />}
                      </span>
                    </button>
                    {!isEmpty && expanded && (
                      <div className="py-1">
                        {g.emps.map(e => renderEmpButton(e, g.reason))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })() : (
          /* ── Regular add mode ── */
          <>
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
                    onClick={() => handleSelectEmployee(e.employee_id, e.employee_name)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-slate-50 text-slate-700 border border-transparent hover:border-slate-200 transition-colors text-right"
                  >
                    <span className="inline-flex items-center gap-1">
                      {e.employee_name}
                      {shiftLeaderIds?.has(e.employee_id) && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded px-0.5 leading-none whitespace-nowrap">א׳&nbsp;משמרת</span>
                      )}
                    </span>
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
                        onClick={() => handleSelectEmployee(e.employee_id, e.employee_name)}
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

            {available.length === 0 && ineligible.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-3">
                {searchLower || panelDept ? "לא נמצאו עובדים התואמים את הסינון" : "אין עובדים זמינים"}
              </p>
            )}

            {ineligible.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setShowIneligible(!showIneligible)}
                  className="w-full flex items-center justify-center gap-1.5 mt-1 py-1.5 text-slate-400 hover:text-slate-600"
                  icon={<ChevronDown className={`w-3.5 h-3.5 transition-transform ${showIneligible ? "rotate-180" : ""}`} />}
                  iconSide="after"
                >
                  {showIneligible ? "הסתר לא מתאימים" : `הצג לא מתאימים (${ineligible.length})`}
                </Button>
                {showIneligible && (
                  <div className="space-y-1 mt-1">
                    {ineligible.map(e => (
                      <button
                        key={e.employee_id}
                        onClick={() => handleSelectEmployee(e.employee_id, e.employee_name)}
                        className="w-full flex flex-col items-start px-3 py-2 rounded-lg text-sm bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100 transition-colors text-right"
                      >
                        <span className="inline-flex items-center gap-1">
                          {e.employee_name}
                          {shiftLeaderIds?.has(e.employee_id) && (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded px-0.5 leading-none whitespace-nowrap">א׳&nbsp;משמרת</span>
                          )}
                        </span>
                        <span className="text-[10px] text-rose-400 font-medium">חסר תפקיד: {panelRole}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
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
          {(() => {
            const rows: React.ReactNode[] = [];
            let shiftGroupIdx = -1;
            let lastShiftName = "";
            let colorIdx = 0;

            grid.forEach((row, idx) => {
              const isRoleSlotRow = !!row.role_slot;
              // Insert a group-header row the first time we see a new shift with role slots
              if (isRoleSlotRow && row.shift_name !== lastShiftName) {
                shiftGroupIdx++;
                colorIdx = shiftGroupIdx;
                lastShiftName = row.shift_name;
                rows.push(
                  <tr key={`grp-${row.shift_name}`} className="border-b border-slate-200 bg-slate-100">
                    <td colSpan={weekDays.length + 1} className="px-4 py-1.5">
                      <span className="font-bold text-slate-700 text-sm">{row.shift_name}</span>
                      {row.hours && <span className="mr-2 text-xs text-slate-400 font-normal" dir="ltr">{row.hours}</span>}
                    </td>
                  </tr>
                );
              } else if (!isRoleSlotRow) {
                lastShiftName = "";
                colorIdx = idx;
              }

              const rowBg = isRoleSlotRow
                ? (idx % 2 === 0 ? "bg-white" : "bg-slate-50/40")
                : (idx % 2 === 0 ? "bg-white" : "bg-slate-50/50");

              rows.push(
                <tr key={`${row.shift_name}-${row.role_slot ?? "main"}`} className={`border-b border-slate-100 ${rowBg}`}>
                  <td className={`py-2.5 ${isRoleSlotRow ? "pl-8 pr-3" : "px-4 py-3"}`}>
                    {isRoleSlotRow ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 text-xs">└</span>
                        <span className="text-slate-700 text-sm">{row.role_slot === "__free__" ? "ללא תפקיד ספציפי" : row.role_slot}</span>
                        {row.slot_count !== undefined && (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded px-1">×{row.slot_count}</span>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="font-semibold text-slate-800 text-sm">{row.shift_name}</p>
                        {row.hours && <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{row.hours}</p>}
                      </>
                    )}
                  </td>
                  {weekDays.map(iso => {
                    const emps = row.by_day[iso] ?? [];
                    const cellKey = `${iso}-${row.shift_name}${row.role_slot ? `-${row.role_slot}` : ""}`;
                    const isChanged = changedCells?.has(cellKey);
                    const isSelected = selectedCell?.iso === iso && selectedCell?.shiftName === row.shift_name && selectedCell?.roleSlot === row.role_slot;
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
                        onClick={editable ? () => openPanel(iso, row.shift_name, row.role_slot) : undefined}
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
                                const inferredRole = inferRoleSlot(e.employee_id, row.shift_name);
                                openPanel(iso, row.shift_name, row.role_slot, { id: e.employee_id, name: e.employee_name }, inferredRole || undefined);
                              } : undefined}
                              className={`text-xs ${SHIFT_COLORS[idx % SHIFT_COLORS.length]} border rounded px-1.5 py-0.5 leading-tight inline-flex items-center gap-0.5 justify-center ${
                                over ? "ring-1 ring-red-400" : ""
                              } ${gridSearch && e.employee_name.toLowerCase().includes(gridSearch.toLowerCase()) ? "ring-2 ring-blue-500 ring-offset-1" : !over ? "border-transparent" : ""
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
              );
            });
            return rows;
          })()}
        </tbody>
      </table>
    </div>
  );

  if (!editable) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" dir="rtl">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-slate-800">לוח משמרות שבועי</h3>
            <p className="text-xs text-slate-500 mt-0.5">הרכב עובדים לכל משמרת ויום</p>
          </div>
          <div className="relative w-52">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={gridSearch}
              onChange={e => setGridSearch(e.target.value)}
              placeholder="חיפוש עובד..."
              className="w-full pr-8 pl-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-slate-50"
              dir="rtl"
            />
          </div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="flex h-full" dir="rtl">
      <div className="flex-1 min-w-0 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-slate-800">לוח משמרות שבועי</h3>
            <p className="text-xs text-slate-500 mt-0.5">לחץ על שם עובד להחלפה · גרור להעברה</p>
          </div>
          <div className="relative w-52">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={gridSearch}
              onChange={e => setGridSearch(e.target.value)}
              placeholder="חיפוש עובד..."
              className="w-full pr-8 pl-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-slate-50"
              dir="rtl"
            />
          </div>
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
