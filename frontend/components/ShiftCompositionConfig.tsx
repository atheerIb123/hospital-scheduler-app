"use client";
import React, { useState, useEffect, useRef } from "react";
import type { ShiftConfig, ShiftCompositionData, RoleSlot, ShiftType } from "@/lib/types";
import { DesirabilityStars } from "./ShiftTypeTable";
import { useShiftComposition } from "@/hooks/useShiftComposition";

const HEBREW_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

// ── Small numeric stepper ────────────────────────────────────────────────────
export function Stepper({ value, onChange, min = 0, max = 20 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
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

// ── Single shift card ────────────────────────────────────────────────────────
export function ShiftCard({
  config,
  shiftType,
  columnHeaders,
  onChange,
  onDelete,
  isFocused,
  cardRef,
}: {
  config: ShiftConfig;
  shiftType?: ShiftType;
  columnHeaders: string[];
  onChange: (c: ShiftConfig) => void;
  onDelete: () => void;
  isFocused?: boolean;
  cardRef?: React.RefCallback<HTMLDivElement>;
}) {
  const usedRoles = new Set(config.role_slots.map(r => r.attribute_name));
  const availableToAdd = columnHeaders.filter(h => !usedRoles.has(h));
  const rolesTotal = config.role_slots.reduce((s, r) => s + r.count, 0);
  const freeSlots = Math.max(0, config.total_workers - rolesTotal);
  const defaultDesirability = shiftType?.desirability ?? 3;

  const updateRole = (idx: number, patch: Partial<RoleSlot>) =>
    onChange({ ...config, role_slots: config.role_slots.map((r, i) => i === idx ? { ...r, ...patch } : r) });

  const removeRole = (idx: number) =>
    onChange({ ...config, role_slots: config.role_slots.filter((_, i) => i !== idx) });

  const addRole = (name: string) =>
    onChange({ ...config, role_slots: [...config.role_slots, { attribute_name: name, count: 1 }] });

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-500 ${
        isFocused ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"
      }`}
    >
      {/* Header */}
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <input
              dir="rtl"
              value={config.shift_name}
              onChange={e => onChange({ ...config, shift_name: e.target.value })}
              className="font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 focus:outline-none text-sm px-0.5"
            />
            <input
              dir="ltr"
              value={config.hours}
              onChange={e => onChange({ ...config, hours: e.target.value })}
              placeholder="HH:MM-HH:MM"
              className="text-xs text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 focus:outline-none mr-2 w-24 px-0.5"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold">סה״כ עובדים:</span>
            <Stepper value={config.total_workers} onChange={v => onChange({ ...config, total_workers: v })} min={1} max={20} />
          </div>
          <button type="button" onClick={onDelete} title="מחק משמרת"
            className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Role slots */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">תפקידים נדרשים</p>
          <div className="space-y-2">
            {config.role_slots.map((role, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-wrap">
                {/* Attribute selector */}
                <select
                  value={role.attribute_name}
                  onChange={e => updateRole(idx, { attribute_name: e.target.value })}
                  className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                >
                  <option value={role.attribute_name}>{role.attribute_name}</option>
                  {columnHeaders.filter(h => h !== role.attribute_name && !usedRoles.has(h)).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span className="text-xs text-slate-400">×</span>
                <Stepper value={role.count} onChange={v => updateRole(idx, { count: v })} min={1} max={10} />

                <div className="flex items-center gap-2 mr-2">
                  <DesirabilityStars
                    value={role.score ?? defaultDesirability}
                    onChange={(v) => updateRole(idx, { score: v })}
                  />
                  {role.score !== undefined ? (
                    <button type="button" onClick={() => updateRole(idx, { score: undefined })}
                      className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">
                      איפוס
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400">(רגיל)</span>
                  )}
                </div>

                {/* Prefer sub-attribute (only for shift manager) */}
                {role.attribute_name === "אחראי משמרת" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">העדפה:</span>
                    <select
                      value={role.prefer_sub_attribute ?? ""}
                      onChange={e => updateRole(idx, { prefer_sub_attribute: e.target.value || undefined })}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white text-slate-600"
                    >
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

          {/* Add role */}
          {availableToAdd.length > 0 && (
            <div className="mt-2">
              <select
                value=""
                onChange={e => { if (e.target.value) addRole(e.target.value); }}
                className="text-xs text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
              >
                <option value="">+ הוסף תפקיד</option>
                {availableToAdd.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          )}

          {/* Free slots indicator */}
          {config.total_workers > 0 && (
            <p className="text-[11px] text-slate-400 mt-1.5">
              {freeSlots > 0
                ? `${freeSlots} מקומות פתוחים לכל עובד מתאים`
                : rolesTotal > config.total_workers
                  ? <span className="text-amber-600 font-semibold">⚠ סה״כ תפקידים ({rolesTotal}) עולה על מספר העובדים ({config.total_workers})</span>
                  : "כל המקומות מכוסים על-ידי תפקידים ספציפיים"}
            </p>
          )}
        </div>

        {/* Gender requirements */}
        <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-500">דרישות מגדר:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">גברים לפחות</span>
            <Stepper value={config.min_male} onChange={v => onChange({ ...config, min_male: v })} min={0} max={config.total_workers} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">נשים לפחות</span>
            <Stepper value={config.min_female} onChange={v => onChange({ ...config, min_female: v })} min={0} max={config.total_workers} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ShiftCompositionConfig({
  columnHeaders,
  shiftTypes,
  modeOverride,
  externalData,
  externalSave,
}: {
  columnHeaders: string[];
  shiftTypes: ShiftType[];
  modeOverride?: string;
  externalData?: ShiftCompositionData | null;
  externalSave?: (configs: ShiftConfig[]) => Promise<void>;
}) {
  const hook = useShiftComposition(externalData !== undefined ? undefined : modeOverride);
  const data    = externalData  !== undefined ? externalData  : hook.data;
  const loading = externalData  !== undefined ? false         : hook.loading;
  const loadError = externalData !== undefined ? null          : hook.error;
  const save    = externalSave  !== undefined ? externalSave  : hook.save;
  const [configs, setConfigs] = useState<ShiftConfig[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedShift, setExpandedShift] = useState<string | null>(null);

  // DB is the source of truth — load exactly what was saved, nothing more
  useEffect(() => {
    if (!data) return;
    setConfigs(data.shift_configs);
    setDirty(false);
  }, [data]);

  // When a shift type is deleted from shift types, remove its config row too
  useEffect(() => {
    if (!data) return;
    const allNames = new Set(shiftTypes.flatMap(st => st.names));
    setConfigs(prev => {
      const next = prev.filter(c => allNames.has(c.shift_name));
      if (next.length !== prev.length) { setDirty(true); }
      return next;
    });
  }, [shiftTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (shiftName: string, patch: Partial<ShiftConfig>) => {
    setConfigs(prev => prev.map(c => c.shift_name === shiftName ? { ...c, ...patch } : c));
    setDirty(true);
  };

  const remove = (shiftName: string) => {
    setConfigs(prev => prev.filter(c => c.shift_name !== shiftName));
    setExpandedShift(prev => (prev === shiftName ? null : prev));
    setDirty(true);
  };

  const addShift = (shiftName: string) => {
    setConfigs(prev => [...prev, { shift_name: shiftName, hours: "", total_workers: 1, role_slots: [], min_male: 0, min_female: 0 }]);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await save(configs);
      setDirty(false);
    } catch (e) {
      setSaveError((e as Error).message ?? "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  // Shift types not yet in the composition (available to add)
  const configuredNames = new Set(configs.map(c => c.shift_name));
  const addableShifts = shiftTypes.filter(st => !st.names.some(n => configuredNames.has(n)));

  if (loading) return <div className="h-32 rounded-2xl shimmer" />;
  if (loadError) return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{loadError}</div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-slate-800">הרכב משמרות</h2>
          <p className="text-xs text-slate-500 mt-0.5">הגדרת מספר עובדים ותפקידים נדרשים בכל משמרת</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {saveError && <span className="text-xs text-red-500 font-medium">{saveError}</span>}
          {addableShifts.length > 0 && (
            <select
              value=""
              onChange={e => { if (e.target.value) addShift(e.target.value); }}
              className="text-xs text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 bg-blue-50 hover:bg-blue-100 focus:outline-none cursor-pointer"
            >
              <option value="">+ הוסף משמרת</option>
              {addableShifts.map(st => (
                <option key={st.id} value={st.names[0]}>{st.names[0]}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-sm"
          >
            {saving ? "שומר..." : "שמור שינויים"}
          </button>
        </div>
      </div>

      {configs.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          <p className="font-medium">אין סוגי משמרות</p>
          <p className="mt-1">הוסף משמרות בלשונית &quot;סוגי משמרות&quot; כדי להגדיר את הרכבן</p>
        </div>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-right">
              <th className="px-4 py-3 font-semibold text-slate-500 text-xs">משמרת</th>
              <th className="px-4 py-3 font-semibold text-slate-500 text-xs text-center w-28">עובדים</th>
              <th className="px-4 py-3 font-semibold text-slate-500 text-xs">תפקידים נדרשים</th>
              <th className="px-4 py-3 font-semibold text-slate-500 text-xs text-center w-28">מגדר</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {configs.map((cfg, idx) => {
              const expanded = expandedShift === cfg.shift_name;
              const rolesTotal = cfg.role_slots.reduce((s, r) => s + r.count, 0);
              const freeSlots = Math.max(0, cfg.total_workers - rolesTotal);
              const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/50";
              const available = columnHeaders.filter(h => !cfg.role_slots.some(r => r.attribute_name === h));

              return (
                <React.Fragment key={cfg.shift_name}>
                  <tr
                    onClick={() => setExpandedShift(expanded ? null : cfg.shift_name)}
                    className={`border-b border-slate-100 transition-colors cursor-pointer select-none ${
                      expanded ? "bg-blue-50/40 border-blue-100" : `${rowBg} hover:bg-blue-50/20`
                    }`}
                  >
                    {/* Name + hours + workers summary */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 text-sm">{cfg.shift_name}</p>
                      {cfg.hours && <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{cfg.hours}</p>}
                    </td>

                    {/* Workers */}
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">
                        {cfg.total_workers} עובדים
                      </span>
                    </td>

                    {/* Role slots summary */}
                    <td className="px-4 py-3">
                      {cfg.role_slots.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">לא הוגדרו תפקידים</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {cfg.role_slots.map((r, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg border border-blue-100">
                              {r.attribute_name} × {r.count}
                            </span>
                          ))}
                          {freeSlots > 0 && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-lg border border-slate-200">
                              +{freeSlots} פתוח
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Gender summary */}
                    <td className="px-4 py-3 text-center">
                      {cfg.min_male > 0 || cfg.min_female > 0 ? (
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
                          {cfg.min_male > 0 && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">ג׳ ≥{cfg.min_male}</span>}
                          {cfg.min_female > 0 && <span className="px-1.5 py-0.5 bg-pink-50 text-pink-700 rounded border border-pink-100">נ׳ ≥{cfg.min_female}</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
                          expanded ? "text-blue-600 bg-blue-100" : "text-slate-400 group-hover:text-blue-500"
                        }`}>
                          {expanded ? "סגור" : "ערוך"}
                        </span>
                        <button
                          type="button"
                          onClick={() => remove(cfg.shift_name)}
                          className="w-7 h-7 inline-flex items-center justify-center rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                          title="הסר מהרכב"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded editor */}
                  {expanded && (
                    <tr className="border-b border-blue-100 bg-blue-50/20">
                      <td colSpan={5} className="px-6 py-5" onClick={e => e.stopPropagation()}>
                        <div className="space-y-4 max-w-xl">

                          {/* Hours + total workers */}
                          <div className="flex items-center gap-6 flex-wrap">
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1.5">שעות</label>
                              <input
                                dir="ltr"
                                type="text"
                                placeholder="07:00-15:00"
                                value={cfg.hours}
                                onChange={e => update(cfg.shift_name, { hours: e.target.value })}
                                onClick={e => e.stopPropagation()}
                                className="w-32 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1.5">סה״כ עובדים</label>
                              <div onClick={e => e.stopPropagation()}>
                                <Stepper value={cfg.total_workers} onChange={v => update(cfg.shift_name, { total_workers: v })} min={1} max={20} />
                              </div>
                            </div>
                          </div>

                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">תפקידים נדרשים</p>

                          {cfg.role_slots.length === 0 && columnHeaders.length === 0 && (
                            <p className="text-xs text-slate-400 italic">ייבא קובץ עובדים תחילה כדי לראות תכונות</p>
                          )}

                          <div className="space-y-2">
                            {cfg.role_slots.map((role, roleIdx) => {
                              const usedRoles = new Set(cfg.role_slots.map(r => r.attribute_name));
                              return (
                                <div key={roleIdx} className="flex items-center gap-2 flex-wrap">
                                  <select
                                    value={role.attribute_name}
                                    onChange={e => {
                                      const newSlots = cfg.role_slots.map((r, i) =>
                                        i === roleIdx ? { ...r, attribute_name: e.target.value } : r
                                      );
                                      update(cfg.shift_name, { role_slots: newSlots });
                                    }}
                                    className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                                  >
                                    <option value={role.attribute_name}>{role.attribute_name}</option>
                                    {columnHeaders
                                      .filter(h => h !== role.attribute_name && !usedRoles.has(h))
                                      .map(h => <option key={h} value={h}>{h}</option>)}
                                  </select>
                                  <span className="text-xs text-slate-400">×</span>
                                  <Stepper
                                    value={role.count}
                                    onChange={v => {
                                      const newSlots = cfg.role_slots.map((r, i) =>
                                        i === roleIdx ? { ...r, count: v } : r
                                      );
                                      update(cfg.shift_name, { role_slots: newSlots });
                                    }}
                                    min={1} max={cfg.total_workers}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => update(cfg.shift_name, { role_slots: cfg.role_slots.filter((_, i) => i !== roleIdx) })}
                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                                      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                                    </svg>
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {available.length > 0 && (
                            <select
                              value=""
                              onChange={e => {
                                if (!e.target.value) return;
                                update(cfg.shift_name, {
                                  role_slots: [...cfg.role_slots, { attribute_name: e.target.value, count: 1 }],
                                });
                              }}
                              className="text-xs text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 bg-blue-50 hover:bg-blue-100 focus:outline-none cursor-pointer"
                            >
                              <option value="">+ הוסף תפקיד</option>
                              {available.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          )}

                          {rolesTotal > cfg.total_workers && (
                            <p className="text-[11px] text-amber-600 font-semibold">
                              ⚠ סה״כ תפקידים ({rolesTotal}) עולה על מספר העובדים ({cfg.total_workers})
                            </p>
                          )}

                          <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
                            <span className="text-xs font-semibold text-slate-500">דרישות מגדר:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-500">גברים לפחות</span>
                              <Stepper value={cfg.min_male} onChange={v => update(cfg.shift_name, { min_male: v })} min={0} max={cfg.total_workers} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-500">נשים לפחות</span>
                              <Stepper value={cfg.min_female} onChange={v => update(cfg.shift_name, { min_female: v })} min={0} max={cfg.total_workers} />
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
