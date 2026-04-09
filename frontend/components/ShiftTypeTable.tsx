"use client";
import { useState, useRef, useEffect } from "react";
import type { ShiftType, ScheduleOn, DayType, ShiftConfig } from "@/lib/types";
import { ShiftCard } from "./ShiftCompositionConfig";
import { Badge, DeleteIconButton, DropdownPanel, FilterPill } from "@/components/ui";
import { Check, ChevronDown, Pencil } from "lucide-react";
import { BADGE_COLORS, getDayTypeActiveColor } from "@/lib/colors";

const SCHEDULE_ON_OPTIONS: { value: string; label: string; color: string; active: string }[] = [
  { value: "all",      label: "כל הימים",  color: "bg-slate-100 text-slate-600 border-slate-200",   active: "bg-slate-600 text-white border-slate-600"   },
  { value: "weekdays", label: "ימי חול",   color: "bg-blue-100 text-blue-700 border-blue-200",      active: "bg-blue-600 text-white border-blue-600"     },
  { value: "friday",   label: "שישי",      color: "bg-orange-100 text-orange-600 border-orange-200", active: "bg-orange-600 text-white border-orange-600" },
  { value: "weekend",  label: "סוף שבוע",  color: "bg-purple-100 text-purple-700 border-purple-200", active: "bg-purple-600 text-white border-purple-600" },
];

function scheduleOnLabel(value: ScheduleOn | undefined, dayTypes: any[]): { label: string; color: string } {
  const selected = Array.isArray(value) ? value : (value ? [value] : ["all"]);
  if (selected.includes("all")) return { label: "כל הימים", color: "bg-slate-100 text-slate-600 border-slate-200" };

  const options = [...SCHEDULE_ON_OPTIONS, ...dayTypes.map(dt => ({ value: dt.id, label: dt.name, color: dt.color }))];
  const first = options.find(o => o.value === selected[0]);

  if (!first) return { label: "בחר...", color: "bg-slate-100 text-slate-600 border-slate-200" };

  const label = selected.length > 1 ? `${first.label} (+${selected.length - 1})` : first.label;
  return { label: label as string, color: first.color as string };
}

export function attrToBadgeColor(attr: string): string {
  const match = attr.match(/^col_(\d+)$/);
  const idx = match ? parseInt(match[1], 10) - 1 : 0;
  return BADGE_COLORS[idx % BADGE_COLORS.length];
}

export function attrToHeaderName(attr: string, columnHeaders: string[]): string {
  const match = attr.match(/^col_(\d+)$/);
  if (!match) return attr;
  const idx = parseInt(match[1], 10) - 1;
  return columnHeaders[idx] ?? attr;
}

export function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{ direction: "ltr" }}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${checked ? "bg-amber-400" : "bg-slate-200"
        }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${checked ? "translate-x-5" : "translate-x-0"
          }`}
      />
    </button>
  );
}

// Justice points per desirability level (non-linear so each level feels distinct)
export const DESIRABILITY_POINTS: Record<number, number> = { 1: 10, 2: 7, 3: 4, 4: 2, 5: 1 };
export const DESIRABILITY_LABELS: Record<number, string> = {
  1: "לא רצויה בכלל",
  2: "לא רצויה",
  3: "ניטרלי",
  4: "רצויה",
  5: "רצויה מאוד",
};

// Each star position has its own fixed color (so 4★ and 5★ look visually distinct)
const STAR_COLORS_ACTIVE = ["", "text-red-500", "text-orange-400", "text-slate-400", "text-yellow-400", "text-amber-500"];
const STAR_COLORS_HOVER  = ["", "text-red-300", "text-orange-300", "text-slate-300", "text-yellow-300", "text-amber-300"];

// ── Desirability star rating (1–5) ────────────────────────────────────────────
export function DesirabilityStars({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  // When a star is clicked: clear hover so the active colour shows immediately
  const handleClick = (n: number) => {
    setHover(0);
    onChange?.(n);
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="flex gap-0.5" onMouseLeave={() => !readonly && setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => {
          const previewing = !readonly && hover > 0;
          const active     = previewing ? n <= hover : n <= value;
          const colorClass = active
            ? (previewing ? STAR_COLORS_HOVER[n] : STAR_COLORS_ACTIVE[n])
            : "text-slate-200";
          return (
            <button
              key={n}
              type="button"
              disabled={readonly}
              onClick={() => handleClick(n)}
              onMouseEnter={() => !readonly && setHover(n)}
              className={`text-xl leading-none transition-colors disabled:cursor-default ${colorClass}`}
              title={readonly ? undefined : `${DESIRABILITY_LABELS[n]} — ${DESIRABILITY_POINTS[n]} נק׳`}
            >
              ★
            </button>
          );
        })}
      </div>
      {!readonly && (
        <span className="text-[10px] font-medium" style={{ color: value <= 2 ? "#ef4444" : value >= 4 ? "#d97706" : "#94a3b8" }}>
          {DESIRABILITY_LABELS[value]} · {DESIRABILITY_POINTS[value]} נק׳
        </span>
      )}
    </div>
  );
}

// ── Attribute editor dropdown ────────────────────────────────────────────────
export function AttrEditor({
  attrs,
  columnHeaders,
  saving,
  onToggle,
  onClose,
}: {
  attrs: string[];
  columnHeaders: string[];
  saving: boolean;
  onToggle: (attr: string) => void;
  onClose: () => void;
}) {
  if (columnHeaders.length === 0) {
    return (
      <DropdownPanel open={true} onClose={onClose} className="mt-1 right-0 rounded-xl px-4 py-3 w-64">
        <p className="text-xs text-slate-400 italic">ייבא קובץ עובדים תחילה כדי לראות תכונות</p>
      </DropdownPanel>
    );
  }

  return (
    <DropdownPanel open={true} onClose={onClose} className="mt-1 right-0 rounded-xl p-3 w-72">
      <p className="text-xs font-semibold text-slate-500 mb-2.5 px-1">בחר תכונות נדרשות</p>
      <div className="flex flex-wrap gap-1.5">
        {columnHeaders.map((header, i) => {
          const attr = `col_${i + 1}`;
          const checked = attrs.includes(attr);
          const color = attrToBadgeColor(attr);
          return (
            <FilterPill
              key={attr}
              active={checked}
              activeClassName={`${color} scale-105`}
              disabled={saving}
              onClick={() => onToggle(attr)}
              className="inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {checked && <Check className="w-2.5 h-2.5 shrink-0" />}
              {header}
            </FilterPill>
          );
        })}
      </div>
      {saving && (
        <p className="text-xs text-slate-400 mt-2 px-1">שומר...</p>
      )}
    </DropdownPanel>
  );
}


// ── Day-type selector ────────────────────────────────────────────────────────
function DayTypeSelector({ value, onChange, dayTypes }: { value: ScheduleOn; onChange: (v: ScheduleOn) => void; dayTypes: DayType[] }) {
  const [open, setOpen] = useState(false);

  const selected = Array.isArray(value) ? value : (value ? [value as any] : ["all"]);
  const current = scheduleOnLabel(selected, dayTypes);

  const toggle = (val: string) => {
    if (val === "all") {
      onChange(["all"]);
      return;
    }
    const next = selected.filter(v => v !== "all");
    let result: string[];
    if (next.includes(val)) {
      result = next.filter(v => v !== val);
    } else {
      result = [...next, val];
    }

    if (result.length === 0) {
      onChange(["all"]);
      return;
    }

    // Check if "everything" is selected
    const allSpecific = ["weekdays", "friday", "weekend", ...dayTypes.map(dt => dt.id)];
    const hasAllSpecific = allSpecific.every(opt => result.includes(opt));
    if (hasAllSpecific) {
      onChange(["all"]);
    } else {
      onChange(result);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:shadow-sm ${current.color} ${open ? "ring-2 ring-offset-1 ring-blue-300" : ""}`}
      >
        {current.label}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      <DropdownPanel open={open} onClose={() => setOpen(false)} className="mt-1 right-0 rounded-2xl p-2 flex flex-col gap-1 w-48 animate-in slide-in-from-top-1 duration-200">
        <p className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">בחר ימי תזמון</p>
        {SCHEDULE_ON_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${selected.includes(opt.value)
                ? `${opt.active} shadow-sm border border-current`
                : "text-slate-500 hover:bg-slate-50 border border-transparent"
              }`}
          >
            <span>{opt.label}</span>
            {selected.includes(opt.value) && (
              <Check className="w-3 h-3" />
            )}
          </button>
        ))}
        {dayTypes.length > 0 && <div className="h-px bg-slate-100 my-1 mx-2" />}
        {dayTypes.map((dt) => (
          <button
            key={dt.id}
            type="button"
            onClick={() => toggle(dt.id)}
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${selected.includes(dt.id)
                ? `${getDayTypeActiveColor(dt.color)} shadow-sm border border-current`
                : "text-slate-500 hover:bg-slate-50 border border-transparent"
              }`}
          >
            <span className="truncate max-w-[100px]">{dt.name}</span>
            {selected.includes(dt.id) && (
              <Check className="w-3 h-3" />
            )}
          </button>
        ))}
      </DropdownPanel>
    </div>
  );
}

export default function ShiftTypeTable({
  shiftTypes,
  columnHeaders,
  onUpdate,
  onDelete,
  dayTypes,
  compositionConfigs,
  onSaveComposition,
}: {
  shiftTypes: ShiftType[];
  columnHeaders: string[];
  onUpdate: (id: string, data: Partial<ShiftType>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  dayTypes: DayType[];
  compositionConfigs?: ShiftConfig[];
  onSaveComposition?: (configs: ShiftConfig[]) => Promise<void>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const desiredCount = shiftTypes.filter((s) => (s.desirability ?? 3) >= 4).length;

  if (shiftTypes.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center text-slate-400 text-sm">
        אין סוגי משמרות. טען ברירת מחדל או הוסף ידנית.
      </div>
    );
  }

  return (
    <div className="fade-in space-y-4">
      {desiredCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <strong>{desiredCount}</strong> משמרות עם ניקוד ≥ 4 (רצויות) — כל המשמרות יחולקו שווה בין העובדים
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">
            סוגי משמרות
            <span className="mr-2 text-xs font-normal text-slate-400">({shiftTypes.length})</span>
          </h3>
          <span className="text-xs text-slate-400">לחץ על שם או תכונות לעריכה</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-right">
                <th className="px-4 py-3 font-semibold text-slate-500 w-10 text-center">#</th>
                <th className="px-4 py-3 font-semibold text-slate-600">שם משמרת</th>
                <th className="px-4 py-3 font-semibold text-slate-600">{onSaveComposition ? "הרכב תפקידים" : "תכונות נדרשות"}</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center w-28">ימי תזמון</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center w-36">ניקוד רצוי</th>
                {onSaveComposition && <th className="px-4 py-3 font-semibold text-slate-600 text-center w-20">מיוחדת</th>}
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {shiftTypes.map((st, idx) => (
                <ShiftTypeRow
                  key={st.id}
                  shiftType={st}
                  idx={idx}
                  columnHeaders={columnHeaders}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  dayTypes={dayTypes}
                  showSpecial={!!onSaveComposition}
                  expanded={expandedId === st.id}
                  onToggleExpand={() => setExpandedId(prev => prev === st.id ? null : st.id)}
                  compositionConfig={compositionConfigs?.find(c => st.names.includes(c.shift_name))}
                  allCompositionConfigs={compositionConfigs ?? []}
                  onSaveComposition={onSaveComposition}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ShiftTypeRow({
  shiftType,
  idx,
  columnHeaders,
  onUpdate,
  onDelete,
  dayTypes,
  showSpecial,
  expanded,
  onToggleExpand,
  compositionConfig,
  allCompositionConfigs,
  onSaveComposition,
}: {
  shiftType: ShiftType;
  idx: number;
  columnHeaders: string[];
  onUpdate: (id: string, data: Partial<ShiftType>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  dayTypes: DayType[];
  showSpecial: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  compositionConfig?: ShiftConfig;
  allCompositionConfigs: ShiftConfig[];
  onSaveComposition?: (configs: ShiftConfig[]) => Promise<void>;
}) {
  const [editName, setEditName] = useState(shiftType.names.join(", "));
  const [deleting, setDeleting] = useState(false);
  const [attrOpen, setAttrOpen] = useState(false);
  const [localAttrs, setLocalAttrs] = useState<string[]>(shiftType.required_attributes);
  const [savingAttr, setSavingAttr] = useState(false);
  const [localDes, setLocalDes] = useState(shiftType.desirability ?? 3);
  const [savingDes, setSavingDes] = useState(false);
  const [desError, setDesError] = useState(false);

  // Inline composition state
  const [draftConfig, setDraftConfig] = useState<ShiftConfig | null>(null);
  const [savingComp, setSavingComp] = useState(false);

  // Keep local state in sync if parent updates (e.g. after load-defaults)
  useEffect(() => { setLocalAttrs(shiftType.required_attributes); }, [shiftType.required_attributes]);
  useEffect(() => { setLocalDes(shiftType.desirability ?? 3); }, [shiftType.desirability]);
  useEffect(() => { setDraftConfig(null); }, [expanded]);

  const displayConfig: ShiftConfig = draftConfig ?? compositionConfig ?? {
    shift_name: shiftType.names[0],
    hours: "",
    total_workers: 4,
    role_slots: [],
    min_male: 0,
    min_female: 0,
  };

  const handleDesirabilityChange = async (v: number) => {
    setLocalDes(v);
    setDesError(false);
    setSavingDes(true);
    try {
      await onUpdate(shiftType.id, { desirability: v });
    } catch {
      setDesError(true);
      setLocalDes(shiftType.desirability ?? 3);
    } finally {
      setSavingDes(false);
    }
  };

  const handleNameBlur = async () => {
    const names = editName.split(",").map((n) => n.trim()).filter(Boolean);
    if (!names.length || names.join(", ") === shiftType.names.join(", ")) return;
    await onUpdate(shiftType.id, { names });
  };

  const handleAttrToggle = async (attr: string) => {
    const next = localAttrs.includes(attr)
      ? localAttrs.filter((a) => a !== attr)
      : [...localAttrs, attr];
    setLocalAttrs(next);
    setSavingAttr(true);
    try {
      await onUpdate(shiftType.id, { required_attributes: next });
    } finally {
      setSavingAttr(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(shiftType.id);
    } catch {
      setDeleting(false);
    }
  };

  const handleSaveComposition = async () => {
    if (!onSaveComposition) return;
    setSavingComp(true);
    try {
      const others = allCompositionConfigs.filter(c => !shiftType.names.includes(c.shift_name));
      await onSaveComposition([...others, displayConfig]);
      setDraftConfig(null);
    } finally {
      setSavingComp(false);
    }
  };

  const des = localDes;
  const rowBg = des >= 4
    ? "bg-amber-50/60 hover:bg-amber-50"
    : des <= 2
    ? "bg-rose-50/40 hover:bg-rose-50/60"
    : idx % 2 === 0
      ? "hover:bg-slate-50"
      : "bg-slate-50/40 hover:bg-slate-50";

  const colSpan = showSpecial ? 7 : 6;

  return (
    <>
      <tr className={`border-b border-slate-50 transition-all duration-200 ${deleting ? "opacity-40" : ""} ${expanded ? "bg-blue-50/30" : rowBg}`}>
        {/* # */}
        <td className="px-4 py-3 text-center">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
            {idx + 1}
          </span>
        </td>

        {/* Name */}
        <td className="px-4 py-3 relative">
          <input
            dir="rtl"
            className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white rounded-lg px-3 py-1.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameBlur}
          />
        </td>

        {/* Required attributes — derived from role_slots in nursing, editable otherwise */}
        <td className="px-4 py-3">
          {onSaveComposition ? (
            // Nursing mode: read-only display derived from composition role_slots
            <div className="flex flex-wrap gap-1.5 items-center min-h-[2rem] px-2 py-1.5">
              {displayConfig.role_slots.length === 0 ? (
                <span className="text-xs text-slate-400 italic">לפי הרכב</span>
              ) : (
                displayConfig.role_slots.map((slot, i) => (
                  <Badge key={i} className={attrToBadgeColor(slot.attribute_name)}>
                    {slot.attribute_name} ×{slot.count}
                  </Badge>
                ))
              )}
            </div>
          ) : (
            // Standard mode: manual editor
            <div className="relative">
              <button
                type="button"
                onClick={() => setAttrOpen((v) => !v)}
                className={`group w-full text-right flex flex-wrap gap-1.5 items-center rounded-lg px-2 py-1.5 border transition-all min-h-[2rem] ${attrOpen
                    ? "border-blue-300 bg-blue-50/50 ring-2 ring-blue-100"
                    : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
              >
                {localAttrs.length === 0 ? (
                  <span className="text-xs text-slate-400 italic flex items-center gap-1">
                    ללא הגבלה
                    <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </span>
                ) : (
                  <>
                    {localAttrs.map((attr) => (
                      <Badge key={attr} className={attrToBadgeColor(attr)}>
                        {attrToHeaderName(attr, columnHeaders)}
                      </Badge>
                    ))}
                    <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-auto" />
                  </>
                )}
              </button>

              {attrOpen && (
                <AttrEditor
                  attrs={localAttrs}
                  columnHeaders={columnHeaders}
                  saving={savingAttr}
                  onToggle={handleAttrToggle}
                  onClose={() => setAttrOpen(false)}
                />
              )}
            </div>
          )}
        </td>

        {/* Day-type selector */}
        <td className="px-4 py-3 text-center">
          <DayTypeSelector
            value={shiftType.schedule_on ?? (shiftType.friday_only ? "friday" : "all")}
            onChange={(v) => onUpdate(shiftType.id, { schedule_on: v })}
            dayTypes={dayTypes}
          />
        </td>

        {/* Desirability stars */}
        <td className="px-4 py-3 text-center">
          <DesirabilityStars
            value={localDes}
            onChange={handleDesirabilityChange}
          />
          {savingDes && <p className="text-[10px] text-slate-400 mt-0.5">שומר...</p>}
          {desError && <p className="text-[10px] text-red-400 mt-0.5">שגיאה בשמירה</p>}
        </td>

        {/* Is Special Checkbox — nursing only */}
        {showSpecial && (
          <td className="px-4 py-3 text-center">
            <label className="inline-flex items-center justify-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!shiftType.is_special}
                onChange={(e) => onUpdate(shiftType.id, { is_special: e.target.checked })}
                className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 cursor-pointer accent-purple-600"
              />
            </label>
          </td>
        )}

        {/* Actions */}
        <td className="px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-1">
            {onSaveComposition && (
              <button
                type="button"
                onClick={onToggleExpand}
                title="הרכב משמרת"
                className={`w-7 h-7 inline-flex items-center justify-center rounded-full transition-all ${
                  expanded
                    ? "text-blue-600 bg-blue-100 hover:bg-blue-200"
                    : "text-slate-300 hover:text-blue-500 hover:bg-blue-50"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
                  <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            <DeleteIconButton onClick={handleDelete} disabled={deleting} title="מחק משמרת" />
          </div>
        </td>
      </tr>

      {/* Inline composition row */}
      {expanded && (
        <tr className="border-b border-blue-100 bg-blue-50/20">
          <td colSpan={colSpan} className="px-4 py-4">
            <div className="max-w-2xl">
              <ShiftCard
                config={displayConfig}
                shiftType={shiftType}
                columnHeaders={columnHeaders}
                onChange={setDraftConfig}
                onDelete={() => {
                  if (confirm("לאפס את הרכב המשמרת?")) {
                    const others = allCompositionConfigs.filter(c => !shiftType.names.includes(c.shift_name));
                    onSaveComposition?.(others).then(onToggleExpand);
                  }
                }}
              />
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={onToggleExpand}
                  className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                  ביטול
                </button>
                <button type="button" onClick={handleSaveComposition} disabled={savingComp || !draftConfig}
                  className="px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {savingComp ? "שומר..." : "שמור"}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
