"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import type { ShiftOverride, RoleSlot, ShiftConfig, ShiftType } from "@/lib/types";
import * as api from "@/lib/api";

const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function Stepper({ value, onChange, min = 0, max = 20 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold flex items-center justify-center transition-colors">−</button>
      <input
        type="number" min={min} max={max} value={value}
        onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
        className="w-10 text-center text-sm font-semibold border border-slate-200 rounded-lg py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
      />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold flex items-center justify-center transition-colors">+</button>
    </div>
  );
}

function isNextDay(isoA: string, isoB: string) {
  const d = new Date(isoA);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10) === isoB;
}

function getDatesInRange(startStr: string, endStr: string): string[] {
  const dates = [];
  const curr = new Date(startStr);
  const end = new Date(endStr);
  while (curr <= end) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

interface ShiftOverrideGroup {
  overrideProps: Omit<ShiftOverride, 'date'>;
  items: ShiftOverride[]; // contains the full overrides, including date
}

function groupShiftOverrides(overrides: ShiftOverride[]): ShiftOverrideGroup[] {
    const getKey = (o: ShiftOverride): string => {
        const { date, ...rest } = o;
        const sortedRoleSlots = [...(rest.role_slots || [])].sort((a, b) => (a.attribute_name || "").localeCompare(b.attribute_name || ""));
        return JSON.stringify({ ...rest, role_slots: sortedRoleSlots });
    };

    const byKey: Record<string, ShiftOverride[]> = {};
    for (const o of overrides) {
        const key = getKey(o);
        if (!byKey[key]) byKey[key] = [];
        byKey[key].push(o);
    }

    const finalGroups: ShiftOverrideGroup[] = [];
    for (const key in byKey) {
        const groupItems = byKey[key].sort((a, b) => a.date.localeCompare(b.date));
        if (groupItems.length === 0) continue;

        let currentRange: ShiftOverride[] = [groupItems[0]];
        const { date, ...overrideProps } = groupItems[0];

        for (let i = 1; i < groupItems.length; i++) {
            const prev = currentRange[currentRange.length - 1];
            const curr = groupItems[i];
            if (isNextDay(prev.date, curr.date)) {
                currentRange.push(curr);
            } else {
                finalGroups.push({ overrideProps, items: currentRange });
                currentRange = [curr];
            }
        }
        finalGroups.push({ overrideProps, items: currentRange });
    }

    return finalGroups.sort((a, b) => a.items[0].date.localeCompare(b.items[0].date));
}

// ── Override editor modal ─────────────────────────────────────────────────────
function OverrideEditor({
  data,
  shiftConfigs,
  shiftTypes,
  columnHeaders,
  onSave,
  onCancel,
}: {
  data: { override: Partial<ShiftOverride>; rangeEnd?: string };
  shiftConfigs: ShiftConfig[];
  shiftTypes: ShiftType[];
  columnHeaders: string[];
  onSave: (o: ShiftOverride) => Promise<void>;
  onCancel: () => void;
}) {
  const { override, rangeEnd } = data;
  const isNew = !override.shift_name;

  const [startDate, setStartDate] = useState(override.date ?? "");
  const [endDate, setEndDate] = useState(rangeEnd ?? override.date ?? "");
  const [shiftName, setShiftName] = useState(override.shift_name ?? (shiftConfigs[0]?.shift_name ?? ""));

  const base = shiftConfigs.find(c => c.shift_name === shiftName);

  const [totalWorkers, setTotalWorkers] = useState(override.total_workers ?? base?.total_workers ?? 4);
  const [roleSlots, setRoleSlots] = useState<any[]>(override.role_slots ?? base?.role_slots ?? []);
  const [minMale, setMinMale] = useState(override.min_male ?? base?.min_male ?? 0);
  const [minFemale, setMinFemale] = useState(override.min_female ?? base?.min_female ?? 0);
  const [saving, setSaving] = useState(false);

  const activeShiftType = shiftTypes.find(st => st.names.includes(shiftName));
  const defaultScore = activeShiftType?.desirability ?? 3;

  const handleShiftChange = (name: string) => {
    setShiftName(name);
    if (isNew) {
      const newBase = shiftConfigs.find(c => c.shift_name === name);
      if (newBase) {
        setTotalWorkers(newBase.total_workers);
        setRoleSlots(newBase.role_slots.map(r => ({ ...r })));
        setMinMale(newBase.min_male);
        setMinFemale(newBase.min_female);
      }
    }
  };

  const usedRoles = new Set(roleSlots.map(r => r.attribute_name));
  const availableToAdd = columnHeaders.filter(h => !usedRoles.has(h));

  const updateRole = (idx: number, patch: Partial<RoleSlot>) =>
    setRoleSlots(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const removeRole = (idx: number) =>
    setRoleSlots(prev => prev.filter((_, i) => i !== idx));
  const addRole = (name: string) =>
    setRoleSlots(prev => [...prev, { attribute_name: name, count: 1 }]);

  const rolesTotal = roleSlots.reduce((s, r) => s + r.count, 0);
  const freeSlots = Math.max(0, totalWorkers - rolesTotal);

  const handleSave = async () => {
    if (!startDate || !shiftName) return;
    const finalEnd = endDate && endDate >= startDate ? endDate : startDate;

    setSaving(true);
    try {
      const dates = getDatesInRange(startDate, finalEnd);
      for (const d of dates) {
        await onSave({ date: d, shift_name: shiftName, total_workers: totalWorkers, role_slots: roleSlots, min_male: minMale, min_female: minFemale });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">עריכת הרכב ספציפי</h3>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Date + shift name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{isNew ? "מתאריך" : "תאריך"}</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={!isNew && !rangeEnd}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
              {(isNew || rangeEnd) && (
                <>
                  <label className="block text-xs font-semibold text-slate-500 mt-2 mb-1">{isNew ? "עד תאריך (אופציונלי)" : "עד תאריך"}</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate}
                    disabled={!isNew && !rangeEnd}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
                </>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">משמרת</label>
              {shiftConfigs.length > 0 ? (
                <select
                  dir="rtl"
                  value={shiftName}
                  onChange={e => handleShiftChange(e.target.value)}
                  disabled={!isNew}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white disabled:bg-slate-50 disabled:text-slate-500"
                >
                  {shiftConfigs.map(c => (
                    <option key={c.shift_name} value={c.shift_name}>{c.shift_name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-400 italic py-2 px-3 border border-slate-200 rounded-xl bg-slate-50">
                  הגדר תבניות משמרות תחילה
                </p>
              )}
            </div>
          </div>

          {/* Total workers */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">סה״כ עובדים:</span>
            <Stepper value={totalWorkers} onChange={setTotalWorkers} min={1} max={20} />
            {base && base.total_workers !== totalWorkers && (
              <span className="text-[10px] text-slate-400">(ברירת מחדל: {base.total_workers})</span>
            )}
          </div>

          {/* Role slots */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">תפקידים נדרשים</p>
            <div className="space-y-2">
              {roleSlots.map((role, idx) => (
                <div key={idx} className="flex items-center gap-2 flex-wrap">
                  <select
                    value={role.attribute_name}
                    onChange={e => updateRole(idx, { attribute_name: e.target.value })}
                    className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white">
                    <option value={role.attribute_name}>{role.attribute_name}</option>
                    {columnHeaders.filter(h => h !== role.attribute_name && !usedRoles.has(h)).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-400">×</span>
                  <Stepper value={role.count} onChange={v => updateRole(idx, { count: v })} min={1} max={10} />
                  
                  {/* Score override */}
                  <div className="flex items-center gap-1 mr-2 bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-medium">ניקוד:</span>
                    <input type="number" step="0.1" placeholder={`רגיל (${defaultScore})`} value={role.score ?? ""} onChange={e => updateRole(idx, { score: e.target.value ? Number(e.target.value) : undefined } as any)}
                      className="w-16 text-center text-xs font-semibold bg-transparent focus:outline-none focus:bg-white rounded" />
                  </div>

                  {role.attribute_name === "אחראי משמרת" && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">העדפה:</span>
                      <select
                        value={role.prefer_sub_attribute ?? ""}
                        onChange={e => updateRole(idx, { prefer_sub_attribute: e.target.value || undefined })}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white text-slate-600">
                        <option value="">ללא העדפה</option>
                        {columnHeaders.filter(h => h !== "אחראי משמרת").map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button type="button" onClick={() => removeRole(idx)}
                    className="text-slate-300 hover:text-red-500 transition-colors mr-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            {availableToAdd.length > 0 && (
              <div className="mt-2">
                <select value="" onChange={e => { if (e.target.value) addRole(e.target.value); }}
                  className="text-xs text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer">
                  <option value="">+ הוסף תפקיד</option>
                  {availableToAdd.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            )}
            {totalWorkers > 0 && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                {freeSlots > 0
                  ? `${freeSlots} מקומות פתוחים לכל עובד מתאים`
                  : rolesTotal > totalWorkers
                    ? <span className="text-amber-600 font-semibold">⚠ סה״כ תפקידים ({rolesTotal}) עולה על מספר העובדים ({totalWorkers})</span>
                    : "כל המקומות מכוסים על-ידי תפקידים ספציפיים"}
              </p>
            )}
          </div>

          {/* Gender */}
          <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500">דרישות מגדר:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">גברים לפחות</span>
              <Stepper value={minMale} onChange={setMinMale} min={0} max={totalWorkers} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">נשים לפחות</span>
              <Stepper value={minFemale} onChange={setMinFemale} min={0} max={totalWorkers} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 justify-end">
            <button type="button" onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              ביטול
            </button>
            <button type="button" disabled={saving || !startDate || !shiftName} onClick={handleSave}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "שומר..." : "שמור"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Grouped override row ──────────────────────────────────────────────────────
function GroupedOverrideRow({ group, shiftConfigs, onDelete, onEdit }: {
    group: ShiftOverrideGroup;
    shiftConfigs: ShiftConfig[];
    onDelete: (date: string, shiftName: string) => Promise<void>;
    onEdit: (data: { override: Partial<ShiftOverride>; rangeEnd?: string }) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const { overrideProps, items } = group;
    const isRange = items.length > 1;

    const formatDate = (d: string) => {
        const [y, m, day] = d.split("-");
        return `${day}/${m}/${y}`;
    };

    const displayDate = isRange
        ? `${formatDate(items[0].date)} – ${formatDate(items[items.length - 1].date)}`
        : formatDate(items[0].date);

    const base = shiftConfigs.find(c => c.shift_name === overrideProps.shift_name);
    const rolesDesc = (overrideProps.role_slots ?? []).map(r => `${r.attribute_name} ×${r.count}`).join(", ");

    return (
        <>
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800">{displayDate}</span>
                        {isRange && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">{items.length} ימים</span>}
                        <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">{overrideProps.shift_name}</span>
                        {overrideProps.total_workers !== undefined && overrideProps.total_workers !== base?.total_workers && (
                            <span className="text-xs text-slate-500">{overrideProps.total_workers} עובדים</span>
                        )}
                    </div>
                    {rolesDesc && <p className="text-xs text-slate-500 mt-0.5 truncate">{rolesDesc}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {isRange && (
                        <button type="button" onClick={() => setExpanded(e => !e)}
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                                <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                    <button type="button" onClick={() => onEdit({ override: items[0], rangeEnd: isRange ? items[items.length - 1].date : undefined })}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474ZM4.75 14.25h-2a.75.75 0 0 1 0-1.5h2a.75.75 0 0 1 0 1.5Z" />
                        </svg>
                    </button>
                    <button type="button" onClick={() => {
                        if (isRange) {
                            if (window.confirm(`למחוק את כל ${items.length} העקיפות בטווח זה?`)) {
                                items.forEach(item => onDelete(item.date, item.shift_name));
                            }
                        } else {
                            onDelete(items[0].date, items[0].shift_name);
                        }
                    }}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.712Z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
            {isRange && expanded && (
                <div className="pl-8 pr-4 py-2 border-t border-amber-200/50 space-y-1">
                    {items.map(item => (
                        <div key={item.date} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{formatDate(item.date)}</span>
                            <button type="button" onClick={() => onDelete(item.date, item.shift_name)} title="מחק יום זה בלבד"
                                className="w-6 h-6 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.712Z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ShiftInstanceOverrides({
  shiftConfigs,
  shiftTypes,
  columnHeaders,
}: {
  shiftConfigs: ShiftConfig[];
  shiftTypes: ShiftType[];
  columnHeaders: string[];
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [overrides, setOverrides] = useState<ShiftOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ override: Partial<ShiftOverride>; rangeEnd?: string } | null>(null);
  const groupedOverrides = useMemo(() => groupShiftOverrides(overrides), [overrides]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getShiftOverrides(year, month);
      setOverrides(result.sort((a, b) => a.date.localeCompare(b.date) || a.shift_name.localeCompare(b.shift_name)));
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { reload(); }, [reload]);

  const handleSave = async (o: ShiftOverride) => {
    await api.saveShiftOverride(o);
    setEditing(null);
    await reload();
  };

  const handleDelete = async (date: string, shiftName: string) => {
    await api.deleteShiftOverride(date, shiftName);
    setOverrides(prev => prev.filter(o => !(o.date === date && o.shift_name === shiftName)));
  };

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-800">עקיפות הרכב ספציפיות</h2>
          <p className="text-xs text-slate-500 mt-0.5">הגדר הרכב שונה למשמרת ביום ספציפי — ישנה עדיפות על התבנית הכללית</p>
        </div>
        <button type="button" onClick={() => setEditing({ override: {} })}
          disabled={shiftConfigs.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
          </svg>
          הוסף עקיפה
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Month navigation */}
        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={prevMonth}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="text-base font-semibold text-slate-800 w-32 text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button type="button" onClick={nextMonth}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* No templates warning */}
        {shiftConfigs.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 text-center">
            יש להגדיר תבניות משמרות תחילה בלשונית "הרכב משמרות"
          </div>
        )}

        {/* Overrides list */}
        {loading ? (
          <div className="space-y-2">
            {[1,2].map(i => <div key={i} className="h-12 rounded-xl shimmer" />)}
          </div>
        ) : overrides.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm">אין עקיפות ל{MONTH_NAMES[month - 1]} {year}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groupedOverrides.map((g, i) => (
              <GroupedOverrideRow
                key={i}
                group={g}
                shiftConfigs={shiftConfigs}
                onDelete={handleDelete}
                onEdit={setEditing}
              />
            ))}
          </div>
        )}
      </div>

      {/* Editor modal */}
      {editing !== null && (
        <OverrideEditor
          data={editing}
          shiftConfigs={shiftConfigs}
          shiftTypes={shiftTypes}
          columnHeaders={columnHeaders}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
