"use client";
import { useState, useRef, useEffect } from "react";
import type { ShiftType, ScheduleOn } from "@/lib/types";

const SCHEDULE_ON_OPTIONS: { value: ScheduleOn; label: string; color: string }[] = [
  { value: "all",      label: "כל הימים",  color: "bg-slate-100 text-slate-600 border-slate-200" },
  { value: "weekdays", label: "ימי חול",   color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "friday",   label: "שישי",      color: "bg-orange-100 text-orange-600 border-orange-200" },
  { value: "weekend",  label: "סוף שבוע",  color: "bg-purple-100 text-purple-700 border-purple-200" },
];

function scheduleOnLabel(value: ScheduleOn | undefined): { label: string; color: string } {
  const opt = SCHEDULE_ON_OPTIONS.find(o => o.value === (value ?? "all"));
  return opt ?? SCHEDULE_ON_OPTIONS[0];
}

const BADGE_COLORS = [
  "bg-violet-100 text-violet-700 border-violet-200",
  "bg-sky-100 text-sky-700 border-sky-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-cyan-100 text-cyan-700 border-cyan-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-teal-100 text-teal-700 border-teal-200",
];

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
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        checked ? "bg-amber-400" : "bg-slate-200"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ── Attribute editor dropdown ────────────────────────────────────────────────
function AttrEditor({
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (columnHeaders.length === 0) {
    return (
      <div ref={ref} className="absolute z-50 mt-1 right-0 bg-white rounded-xl shadow-lg border border-slate-200 px-4 py-3 text-xs text-slate-400 italic w-64">
        ייבא קובץ עובדים תחילה כדי לראות תכונות
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 right-0 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-72"
    >
      <p className="text-xs font-semibold text-slate-500 mb-2.5 px-1">בחר תכונות נדרשות</p>
      <div className="flex flex-wrap gap-1.5">
        {columnHeaders.map((header, i) => {
          const attr = `col_${i + 1}`;
          const checked = attrs.includes(attr);
          const color = attrToBadgeColor(attr);
          return (
            <button
              key={attr}
              type="button"
              disabled={saving}
              onClick={() => onToggle(attr)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all disabled:opacity-50 ${
                checked
                  ? `${color} shadow-sm scale-105`
                  : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600"
              }`}
            >
              {checked && (
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1.5 5l2.5 2.5 4.5-4.5" />
                </svg>
              )}
              {header}
            </button>
          );
        })}
      </div>
      {saving && (
        <p className="text-xs text-slate-400 mt-2 px-1">שומר...</p>
      )}
    </div>
  );
}

// ── Day-type selector ────────────────────────────────────────────────────────
function DayTypeSelector({ value, onChange }: { value: ScheduleOn; onChange: (v: ScheduleOn) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = scheduleOnLabel(value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:shadow-sm ${current.color} ${open ? "ring-2 ring-offset-1 ring-blue-300" : ""}`}
      >
        {current.label}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-60">
          <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 flex flex-col gap-0.5 w-32">
          {SCHEDULE_ON_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-center px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                value === opt.value
                  ? `${opt.color} shadow-sm`
                  : "text-slate-500 border-transparent hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────
export default function ShiftTypeTable({
  shiftTypes,
  columnHeaders,
  onUpdate,
  onToggleDesired,
  onDelete,
}: {
  shiftTypes: ShiftType[];
  columnHeaders: string[];
  onUpdate: (id: string, data: Partial<Pick<ShiftType, "names" | "schedule_on" | "required_attributes">>) => Promise<ShiftType>;
  onToggleDesired: (id: string, value: boolean) => Promise<ShiftType>;
  onDelete: (id: string) => Promise<void>;
}) {
  const desiredCount = shiftTypes.filter((s) => s.is_desired).length;

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
          <strong>{desiredCount}</strong> משמרות מסומנות כרצויות — הסולבר יחלק אותן באופן שווה
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
                <th className="px-4 py-3 font-semibold text-slate-600">תכונות נדרשות</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center w-28">ימי תזמון</th>
                <th className="px-4 py-3 font-semibold text-amber-600 text-center w-20">רצוי ★</th>
                <th className="px-4 py-3 w-12"></th>
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
                  onToggleDesired={onToggleDesired}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────
function ShiftTypeRow({
  shiftType,
  idx,
  columnHeaders,
  onUpdate,
  onToggleDesired,
  onDelete,
}: {
  shiftType: ShiftType;
  idx: number;
  columnHeaders: string[];
  onUpdate: (id: string, data: Partial<Pick<ShiftType, "names" | "schedule_on" | "required_attributes">>) => Promise<ShiftType>;
  onToggleDesired: (id: string, value: boolean) => Promise<ShiftType>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editName, setEditName] = useState(shiftType.names.join(", "));
  const [deleting, setDeleting] = useState(false);
  const [attrOpen, setAttrOpen] = useState(false);
  const [localAttrs, setLocalAttrs] = useState<string[]>(shiftType.required_attributes);
  const [savingAttr, setSavingAttr] = useState(false);

  // Keep local attrs in sync if parent updates (e.g. after load-defaults)
  useEffect(() => {
    setLocalAttrs(shiftType.required_attributes);
  }, [shiftType.required_attributes]);

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

  const rowBg = shiftType.is_desired
    ? "bg-amber-50/60 hover:bg-amber-50"
    : idx % 2 === 0
    ? "hover:bg-slate-50"
    : "bg-slate-50/40 hover:bg-slate-50";

  return (
    <tr className={`border-b border-slate-50 transition-all duration-200 ${deleting ? "opacity-40" : ""} ${rowBg}`}>
      {/* # */}
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
          {idx + 1}
        </span>
      </td>

      {/* Name */}
      <td className="px-4 py-3">
        <input
          dir="rtl"
          className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white rounded-lg px-3 py-1.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleNameBlur}
        />
      </td>

      {/* Required attributes — click to edit */}
      <td className="px-4 py-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setAttrOpen((v) => !v)}
            className={`group w-full text-right flex flex-wrap gap-1.5 items-center rounded-lg px-2 py-1.5 border transition-all min-h-[2rem] ${
              attrOpen
                ? "border-blue-300 bg-blue-50/50 ring-2 ring-blue-100"
                : "border-transparent hover:border-slate-200 hover:bg-slate-50"
            }`}
          >
            {localAttrs.length === 0 ? (
              <span className="text-xs text-slate-400 italic flex items-center gap-1">
                ללא הגבלה
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity">
                  <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474Z" />
                  <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V8a.75.75 0 0 1 1.5 0v3.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H8a.75.75 0 0 1 0 1.5H4.75Z" />
                </svg>
              </span>
            ) : (
              <>
                {localAttrs.map((attr) => (
                  <span
                    key={attr}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${attrToBadgeColor(attr)}`}
                  >
                    {attrToHeaderName(attr, columnHeaders)}
                  </span>
                ))}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-auto">
                  <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474Z" />
                  <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V8a.75.75 0 0 1 1.5 0v3.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H8a.75.75 0 0 1 0 1.5H4.75Z" />
                </svg>
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
      </td>

      {/* Day-type selector */}
      <td className="px-4 py-3 text-center">
        <DayTypeSelector
          value={shiftType.schedule_on ?? (shiftType.friday_only ? "friday" : "all")}
          onChange={(v) => onUpdate(shiftType.id, { schedule_on: v })}
        />
      </td>

      {/* Desired toggle */}
      <td className="px-4 py-3 text-center">
        <ToggleSwitch
          checked={shiftType.is_desired}
          onChange={() => onToggleDesired(shiftType.id, !shiftType.is_desired)}
        />
      </td>

      {/* Delete */}
      <td className="px-4 py-3 text-center">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="w-7 h-7 inline-flex items-center justify-center rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
          title="מחק משמרת"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
