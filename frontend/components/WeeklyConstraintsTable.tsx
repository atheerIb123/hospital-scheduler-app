"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ChevronRight, ChevronLeft, Search, X, Loader2, Check, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui";
import type { Employee, Constraint, CreateConstraintPayload } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HEB_DAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

const SHIFT_STYLE: Record<string, { pill: string; active: string; inactive: string }> = {
  "בוקר": {
    pill:     "bg-sky-100 text-sky-700 border border-sky-200",
    active:   "bg-sky-500 text-white border-sky-500",
    inactive: "bg-white text-sky-700 border-sky-200 hover:bg-sky-50",
  },
  "ערב": {
    pill:     "bg-amber-100 text-amber-700 border border-amber-200",
    active:   "bg-amber-500 text-white border-amber-500",
    inactive: "bg-white text-amber-700 border-amber-200 hover:bg-amber-50",
  },
  "לילה": {
    pill:     "bg-violet-100 text-violet-700 border border-violet-200",
    active:   "bg-violet-600 text-white border-violet-600",
    inactive: "bg-white text-violet-700 border-violet-200 hover:bg-violet-50",
  },
};

function shiftStyle(name: string) {
  return SHIFT_STYLE[name] ?? {
    pill:     "bg-slate-100 text-slate-600 border border-slate-200",
    active:   "bg-slate-500 text-white border-slate-500",
    inactive: "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
  };
}

function getWeekStart(d: Date): Date {
  const dt = new Date(d);
  dt.setDate(dt.getDate() - dt.getDay());
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function addDays(d: Date, n: number): Date {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}
function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function isToday(d: Date): boolean {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PopupState {
  empName:   string;
  dateIso:   string;
  label:     string;
  top:       number;
  left:      number;
  maxHeight: number;
}

interface Props {
  employees:   Employee[];
  constraints: Constraint[];
  shiftNames:  string[];
  onAdd:    (payload: CreateConstraintPayload) => Promise<unknown>;
  onUpdate: (id: string, payload: Partial<CreateConstraintPayload>) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyConstraintsTable({
  employees, constraints, shiftNames,
  onAdd, onUpdate, onDelete,
}: Props) {
  const [weekStart,    setWeekStart]    = useState(() => getWeekStart(new Date()));
  const [search,       setSearch]       = useState("");
  const [popup,        setPopup]        = useState<PopupState | null>(null);
  const [reason,       setReason]       = useState("");
  const [savingReason, setSavingReason] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // ── Local copy of constraints ──────────────────────────────────────────────
  // We own this state and update it directly after each API call.
  // We also sync it from the parent prop when there's no save in flight,
  // so that external changes (e.g. from the list view) are reflected.
  const [local, setLocal] = useState<Constraint[]>(() => constraints);
  const isSavingRef = useRef(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isSavingRef.current) {
      setLocal(constraints);
    }
  }, [constraints]);

  // ── Constraint lookup ──────────────────────────────────────────────────────
  const cMap = useMemo(() => {
    const m = new Map<string, Constraint>();
    for (const c of local) {
      m.set(`${c.employee_name}|${c.date}`, c);
    }
    return m;
  }, [local]);

  function getC(empName: string, dateIso: string): Constraint | null {
    return cMap.get(`${empName}|${dateIso}`) ?? null;
  }

  function getBlockedShifts(c: Constraint | null): string[] | null {
    if (!c) return null;
    return Array.isArray(c.shifts) ? c.shifts : [];
  }

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // ── Popup ──────────────────────────────────────────────────────────────────
  const popupRef = useRef<HTMLDivElement>(null);

  function openPopup(empName: string, day: Date, el: HTMLElement) {
    const dateIso = toIso(day);
    const r    = el.getBoundingClientRect();
    const w    = 248;
    const gap  = 6;
    const pad  = 8;

    let left = r.left;
    if (left + w > window.innerWidth - pad) left = window.innerWidth - w - pad;
    if (left < pad) left = pad;

    const spaceBelow = window.innerHeight - r.bottom - gap - pad;
    const spaceAbove = r.top - gap - pad;
    const maxHeight  = Math.min(420, Math.max(spaceBelow, spaceAbove));
    const top        = spaceBelow >= spaceAbove
      ? r.bottom + gap
      : r.top - gap - Math.min(420, spaceAbove);

    setReason(getC(empName, dateIso)?.reason ?? "");
    setError(null);
    setPopup({ empName, dateIso, label: `${HEB_DAYS_SHORT[day.getDay()]} ${fmtDate(day)}`, top, left, maxHeight });
  }

  useEffect(() => {
    if (!popup) return;
    function onDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setPopup(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setPopup(null); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [popup]);

  // ── Filtered employees ─────────────────────────────────────────────────────
  const activeEmployees = useMemo(() => employees.filter(e => e.active !== false), [employees]);
  const term = search.trim();
  const visible = term ? activeEmployees.filter(e => e.name.includes(term)) : activeEmployees;

  // ── Toggle logic ─────────────────────────────────────────────────────────
  async function handleToggle(option: string) {
    if (!popup || isSavingRef.current) return;
    const { empName, dateIso } = popup;
    const key = `${empName}|${dateIso}`;
    const c   = getC(empName, dateIso);
    const currentShifts = getBlockedShifts(c); // null=none, []=full day, ["בוקר"]=specific

    isSavingRef.current = true;
    setSavingKey(key);
    setError(null);

    try {
      let nextShifts: string[] | null;

      if (option === "full") {
        // Toggle full-day on/off. Clears any specific shifts.
        const isFullDay = currentShifts !== null && currentShifts.length === 0;
        nextShifts = isFullDay ? null : [];
      } else {
        // Multi-select: toggle this shift independently.
        // If full-day was active, switch to specific-shift mode with just this shift.
        if (currentShifts === null) {
          nextShifts = [option];
        } else if (currentShifts.length === 0) {
          // was full-day → switch to only this shift
          nextShifts = [option];
        } else if (currentShifts.includes(option)) {
          // deselect this shift
          const remaining = currentShifts.filter(s => s !== option);
          nextShifts = remaining.length === 0 ? null : remaining;
        } else {
          // add this shift
          nextShifts = [...currentShifts, option];
        }
      }

      if (nextShifts === null) {
        if (c) { await onDelete(c.id); setLocal(prev => prev.filter(x => x.id !== c.id)); }
      } else {
        if (!c) {
          const result = (await onAdd({ employee_name: empName, date: dateIso, shifts: nextShifts, reason })) as any;
          const created: Constraint = result?.created?.[0] ?? {
            id: String(Date.now()),
            employee_name: empName,
            date: dateIso,
            shifts: nextShifts,
            reason,
          };
          setLocal(prev => [...prev.filter(x => !(x.employee_name === empName && x.date === dateIso)), created]);
        } else {
          const updated = (await onUpdate(c.id, { shifts: nextShifts })) as Constraint | undefined;
          const newEntry: Constraint = updated ?? { ...c, shifts: nextShifts };
          setLocal(prev => prev.map(x => x.id === c.id ? newEntry : x));
        }
      }
    } catch (e) {
      setError((e as Error).message ?? "שגיאה");
    } finally {
      isSavingRef.current = false;
      setSavingKey(null);
    }
  }

  // ── Clear cell ─────────────────────────────────────────────────────────────
  async function handleClear() {
    if (!popup || isSavingRef.current) return;
    const { empName, dateIso } = popup;
    const c = getC(empName, dateIso);
    if (!c) return;
    isSavingRef.current = true;
    setSavingKey(`${empName}|${dateIso}`);
    setError(null);
    try {
      await onDelete(c.id);
      setLocal(prev => prev.filter(x => x.id !== c.id));
    } catch (e) {
      setError((e as Error).message ?? "שגיאה");
    } finally {
      isSavingRef.current = false;
      setSavingKey(null);
    }
  }

  // ── Reason blur → save ────────────────────────────────────────────────────
  async function handleReasonSave() {
    if (!popup) return;
    const c = getC(popup.empName, popup.dateIso);
    if (!c || c.reason === reason) return;
    setSavingReason(true);
    try {
      const updated = await onUpdate(c.id, { reason }) as Constraint | undefined;
      setLocal(prev => prev.map(x => x.id === c.id ? (updated ?? { ...c, reason }) : x));
    } catch { /* silent */ }
    finally { setSavingReason(false); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" dir="rtl">

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="icon" icon={<ChevronRight size={14} />}
            onClick={() => setWeekStart(p => addDays(p, -7))} title="שבוע קודם" />
          <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            {fmtDate(weekStart)} — {fmtDate(weekDays[6])}
          </span>
          <Button variant="icon" icon={<ChevronLeft size={14} />}
            onClick={() => setWeekStart(p => addDays(p, 7))} title="שבוע הבא" />
        </div>

        <Button variant="secondary" size="small" onClick={() => setWeekStart(getWeekStart(new Date()))}>
          השבוע
        </Button>

        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-[160px] max-w-[240px] focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent transition-all">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש עובד..." dir="rtl"
            className="flex-1 text-xs text-slate-700 placeholder-slate-400 outline-none bg-transparent min-w-0" />
          {search && (
            <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {term && <span className="text-[11px] text-slate-400">{visible.length} / {activeEmployees.length}</span>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
        <table className="min-w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-right font-semibold text-slate-600 sticky right-0 bg-slate-50 border-l border-slate-100 min-w-[140px] z-20">
                עובד
              </th>
              {weekDays.map((day, i) => {
                const today = isToday(day);
                const wknd  = day.getDay() === 5 || day.getDay() === 6;
                return (
                  <th key={i} className={[
                    "py-2.5 px-2 text-center min-w-[90px] relative",
                    today ? "bg-blue-50" : wknd ? "bg-amber-50/50" : "bg-slate-50",
                  ].join(" ")}>
                    {today && <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-blue-400" />}
                    <div className={`text-xs font-bold ${today ? "text-blue-600" : "text-slate-700"}`}>
                      {HEB_DAYS_SHORT[day.getDay()]}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${today ? "text-blue-500 font-medium" : "text-slate-400"}`}>
                      {fmtDate(day)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((emp, idx) => (
              <tr key={emp.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                <td className="px-4 py-2 whitespace-nowrap sticky right-0 border-l border-slate-100 bg-inherit z-10">
                  <span className="font-medium text-slate-700 text-sm">{emp.name}</span>
                  {emp.home_department && (
                    <span className="block text-[10px] text-slate-400">{emp.home_department}</span>
                  )}
                </td>
                {weekDays.map((day, j) => {
                  const dateIso = toIso(day);
                  const key     = `${emp.name}|${dateIso}`;
                  const c       = getC(emp.name, dateIso);
                  const blocked = getBlockedShifts(c);
                  const saving  = savingKey === key;
                  const isOpen  = popup?.empName === emp.name && popup?.dateIso === dateIso;
                  const wknd    = day.getDay() === 5 || day.getDay() === 6;
                  const today   = isToday(day);

                  return (
                    <td key={j}
                      onClick={e => !saving && openPopup(emp.name, day, e.currentTarget)}
                      className={[
                        "px-2 py-2 text-center cursor-pointer transition-colors h-[44px]",
                        today  ? "bg-blue-50/30"  : wknd ? "bg-amber-50/20" : "",
                        (blocked !== null && blocked.length === 0) ? "!bg-red-50/60" : "",
                        isOpen  ? "ring-2 ring-inset ring-blue-400" :
                        saving  ? "opacity-50 cursor-default" :
                                  "hover:bg-blue-50/50",
                      ].join(" ")}
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin mx-auto" />
                      ) : blocked === null ? (
                        <span className="text-slate-200 text-xs select-none">—</span>
                      ) : blocked.length === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600 border border-red-200">
                          חופש
                        </span>
                      ) : (
                        <span className="flex flex-wrap gap-0.5 justify-center">
                          {blocked.map(s => (
                            <span key={s} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${shiftStyle(s).pill}`}>
                              {s[0]}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-400 text-sm">
                  {term ? `לא נמצאו עובדים "${term}"` : "אין עובדים פעילים"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-2.5 border-t border-slate-100 bg-slate-50/40 flex-wrap">
        <span className="text-[11px] text-slate-400 font-medium">מקרא:</span>
        <span className="inline-flex items-center gap-1.5 text-[11px]">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600 border border-red-200">חופש</span>
          <span className="text-slate-500">חופש יומי</span>
        </span>
        {shiftNames.map(sh => (
          <span key={sh} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${shiftStyle(sh).pill}`}>
            {sh}
          </span>
        ))}
        <span className="text-[11px] text-slate-400 mr-auto">לחץ על תא לעריכה</span>
      </div>

      {/* Popup */}
      {popup && (() => {
        const c   = getC(popup.empName, popup.dateIso);
        const blocked = getBlockedShifts(c);
        const saving = savingKey === `${popup.empName}|${popup.dateIso}`;
        return (
          <>
            <div className="fixed inset-0 z-[9998]" />
            <div
              ref={popupRef}
              style={{ position: "fixed", top: popup.top, left: popup.left, width: 248, maxHeight: popup.maxHeight, zIndex: 9999 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
              dir="rtl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <CalendarOff size={13} className="text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">{popup.empName}</div>
                    <div className="text-[11px] text-slate-400">{popup.label}</div>
                  </div>
                </div>
                <button onClick={() => setPopup(null)} className="text-slate-300 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors shrink-0 mr-1">
                  <X size={13} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {error && (
                  <div className="text-[11px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                {/* Full day */}
                <button
                  onClick={() => handleToggle("full")}
                  disabled={saving}
                  className={[
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all",
                    blocked !== null && blocked.length === 0
                      ? "bg-red-500 text-white border-red-500 shadow-sm shadow-red-100"
                      : "bg-white text-slate-700 border-slate-200 hover:border-red-200 hover:bg-red-50/50",
                    saving ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${blocked !== null && blocked.length === 0 ? "bg-white/20" : "bg-red-50"}`}>
                    <CalendarOff size={11} className={blocked !== null && blocked.length === 0 ? "text-white" : "text-red-400"} />
                  </span>
                  <span className="flex-1 text-right">חופש יומי מלא</span>
                  {blocked !== null && blocked.length === 0 && <Check size={13} strokeWidth={3} />}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-[10px] text-slate-300 font-semibold">או</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                {/* Shift toggles — horizontal row */}
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 font-medium px-0.5">חסום משמרות ספציפיות</div>
                  <div className="flex gap-1.5">
                    {shiftNames.map(shift => {
                      const st = shiftStyle(shift);
                      const isActive = blocked !== null && blocked.length > 0 && blocked.includes(shift);
                      return (
                        <button
                          key={shift}
                          onClick={() => handleToggle(shift)}
                          disabled={saving}
                          className={[
                            "flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all",
                            isActive ? st.active + " shadow-sm" : st.inactive,
                            saving ? "opacity-60 cursor-not-allowed" : "",
                          ].join(" ")}
                        >
                          {shift}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reason */}
                {blocked !== null && (() => {
                  const savedReason = c?.reason ?? "";
                  const isDirty = reason !== savedReason;
                  return (
                    <div className="space-y-1.5">
                      <div className="text-[11px] text-slate-400 font-medium px-0.5">סיבה (אופציונלי)</div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={reason}
                          onChange={e => setReason(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleReasonSave(); }}
                          placeholder="חופשה, מחלה..."
                          dir="rtl"
                          disabled={saving || savingReason}
                          className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 transition-all"
                        />
                        <button
                          onClick={handleReasonSave}
                          disabled={!isDirty || saving || savingReason}
                          className={[
                            "shrink-0 px-2.5 rounded-xl text-xs font-semibold border transition-all",
                            isDirty
                              ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600"
                              : "bg-slate-50 text-slate-300 border-slate-200 cursor-default",
                          ].join(" ")}
                        >
                          {savingReason ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check size={13} strokeWidth={3} />}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Clear */}
                {c !== null && (
                  <button
                    onClick={handleClear}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-100 hover:border-red-100 transition-all disabled:opacity-50"
                  >
                    <X size={11} />
                    נקה הסתייגות
                  </button>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

