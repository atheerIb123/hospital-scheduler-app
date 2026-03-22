// ─────────────────────────────────────────────────────────────────────────────
// Global color palette — single source of truth for all colored UI elements.
// All class names must be complete static strings so Tailwind JIT can scan them.
// ─────────────────────────────────────────────────────────────────────────────

// violet · sky · emerald · rose · amber · cyan · pink · indigo · teal

/** Attribute badges: shift-type attributes, filter pills, etc.
 *  Format: bg-*-100 text-*-700 border-*-200  */
export const BADGE_COLORS = [
  "bg-violet-100 text-violet-700 border-violet-200",
  "bg-sky-100 text-sky-700 border-sky-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-cyan-100 text-cyan-700 border-cyan-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-teal-100 text-teal-700 border-teal-200",
] as const;

/** Day-type colors. `value` is stored in the DB; `active` is the saturated
 *  version used when a day is highlighted (e.g. in CalendarConfigurator cells).
 *  All strings must be complete static literals so Tailwind JIT can scan them. */
export const DAY_TYPE_COLORS: { value: string; swatch: string; active: string }[] = [
  { value: "bg-violet-100 text-violet-800 border-violet-200",   swatch: "bg-violet-500",  active: "bg-violet-600 text-white border-violet-600"  },
  { value: "bg-sky-100 text-sky-800 border-sky-200",            swatch: "bg-sky-500",     active: "bg-sky-600 text-white border-sky-600"         },
  { value: "bg-emerald-100 text-emerald-800 border-emerald-200", swatch: "bg-emerald-500", active: "bg-emerald-600 text-white border-emerald-600" },
  { value: "bg-rose-100 text-rose-800 border-rose-200",         swatch: "bg-rose-500",    active: "bg-rose-600 text-white border-rose-600"       },
  { value: "bg-amber-100 text-amber-800 border-amber-200",      swatch: "bg-amber-500",   active: "bg-amber-600 text-white border-amber-600"     },
  { value: "bg-cyan-100 text-cyan-800 border-cyan-200",         swatch: "bg-cyan-500",    active: "bg-cyan-600 text-white border-cyan-600"       },
  { value: "bg-pink-100 text-pink-800 border-pink-200",         swatch: "bg-pink-500",    active: "bg-pink-600 text-white border-pink-600"       },
  { value: "bg-indigo-100 text-indigo-800 border-indigo-200",   swatch: "bg-indigo-500",  active: "bg-indigo-600 text-white border-indigo-600"   },
  { value: "bg-teal-100 text-teal-800 border-teal-200",         swatch: "bg-teal-500",    active: "bg-teal-600 text-white border-teal-600"       },
];

/** Returns the saturated active-state class string for a given day-type value,
 *  falling back to a neutral dark slate if the value isn't in the palette. */
export function getDayTypeActiveColor(color: string): string {
  return DAY_TYPE_COLORS.find(c => c.value === color)?.active ?? "bg-slate-600 text-white border-slate-600";
}

/** Employee-table column header objects: { bg, text, ring }  */
export const COLUMN_COLORS = [
  { bg: "bg-violet-100",  text: "text-violet-700",  ring: "ring-violet-300" },
  { bg: "bg-sky-100",     text: "text-sky-700",     ring: "ring-sky-300" },
  { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-300" },
  { bg: "bg-rose-100",    text: "text-rose-700",    ring: "ring-rose-300" },
  { bg: "bg-amber-100",   text: "text-amber-700",   ring: "ring-amber-300" },
  { bg: "bg-cyan-100",    text: "text-cyan-700",    ring: "ring-cyan-300" },
  { bg: "bg-pink-100",    text: "text-pink-700",    ring: "ring-pink-300" },
  { bg: "bg-indigo-100",  text: "text-indigo-700",  ring: "ring-indigo-300" },
  { bg: "bg-teal-100",    text: "text-teal-700",    ring: "ring-teal-300" },
] as const;

/** Shift/employee pill colors for summary tables and schedule.
 *  Extended to 14 entries to cover large shift-type counts.
 *  Format: bg-*-100 text-*-700  */
export const SHIFT_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
  "bg-lime-100 text-lime-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-red-100 text-red-700",
  "bg-blue-100 text-blue-700",
] as const;

/** Same palette but lighter (-50 bg, -800 text) for dense schedule table cells.  */
export const SHIFT_COLORS_LIGHT = [
  "bg-violet-50 text-violet-800",
  "bg-sky-50 text-sky-800",
  "bg-emerald-50 text-emerald-800",
  "bg-rose-50 text-rose-800",
  "bg-amber-50 text-amber-800",
  "bg-cyan-50 text-cyan-800",
  "bg-pink-50 text-pink-800",
  "bg-indigo-50 text-indigo-800",
  "bg-teal-50 text-teal-800",
  "bg-orange-50 text-orange-800",
  "bg-lime-50 text-lime-800",
  "bg-fuchsia-50 text-fuchsia-800",
  "bg-red-50 text-red-800",
  "bg-blue-50 text-blue-800",
] as const;
