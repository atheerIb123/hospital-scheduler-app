"use client";
import { useState, useEffect, useRef } from "react";
import type { ShiftConfig, RoleSlot, ShiftType } from "@/lib/types";
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
export default function ShiftCompositionConfig({ columnHeaders, shiftTypes, focusedShift, onFocusClear }: { columnHeaders: string[]; shiftTypes: ShiftType[]; focusedShift?: string; onFocusClear?: () => void }) {
  const { data, loading, error, save } = useShiftComposition();
  const [configs, setConfigs] = useState<ShiftConfig[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to + flash the focused shift card
  useEffect(() => {
    if (!focusedShift) return;
    const el = cardRefs.current.get(focusedShift);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const timer = setTimeout(() => { onFocusClear?.(); }, 2500);
    return () => clearTimeout(timer);
  }, [focusedShift, onFocusClear]);

  useEffect(() => {
    if (data) { setConfigs(data.shift_configs); setDirty(false); }
  }, [data]);

  const update = (idx: number, c: ShiftConfig) => {
    setConfigs(prev => prev.map((x, i) => i === idx ? c : x));
    setDirty(true);
  };

  const remove = (idx: number) => {
    setConfigs(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try { await save(configs); setDirty(false); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="h-32 rounded-2xl shimmer" />;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{error}</div>;

  const isEmpty = configs.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-slate-800">הרכב משמרות</h2>
          <p className="text-xs text-slate-500 mt-0.5">הגדרת מספר עובדים ותפקידים נדרשים בכל משמרת</p>
        </div>
        <button type="button" disabled={!dirty || saving} onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-sm">
          {saving ? "שומר..." : "שמור שינויים"}
        </button>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 text-slate-400">
          <p className="font-medium">לא הוגדר הרכב משמרות</p>
          <p className="text-sm mt-1">הוסף סוגי משמרות כדי להגדיר את ההרכב שלהן</p>
        </div>
      )}

      {/* Shift cards */}
      {configs.map((cfg, idx) => (
        <ShiftCard
          key={idx}
          config={cfg}
          shiftType={shiftTypes.find(st => st.names.includes(cfg.shift_name))}
          columnHeaders={columnHeaders}
          onChange={c => update(idx, c)}
          onDelete={() => remove(idx)}
          isFocused={focusedShift === cfg.shift_name}
          cardRef={el => {
            if (el) cardRefs.current.set(cfg.shift_name, el);
            else cardRefs.current.delete(cfg.shift_name);
          }}
        />
      ))}
    </div>
  );
}
