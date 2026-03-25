"use client";
import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Select } from "@/components/ui";

// ── Types ──────────────────────────────────────────────────────────────────────

export type DateRangeType = "week" | "month" | "year" | "all" | "custom";

export interface DateRangeValue {
  type: DateRangeType;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  label: string;
}

export interface DateRangePickerProps {
  /** Which range types to show in the dropdown. Default: ["week","month","year"] */
  availableTypes?: DateRangeType[];
  /** Initially selected range type. Default: "month" */
  defaultType?: DateRangeType;
  /** Called whenever the selected range changes (including on mount). */
  onChange: (value: DateRangeValue) => void;
  /** Show prev/next arrow buttons. Default: true */
  showArrows?: boolean;
  /** Show היום button. Default: true */
  showTodayButton?: boolean;
  className?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

const TYPE_LABELS: Record<DateRangeType, string> = {
  week:   "שבוע",
  month:  "חודש",
  year:   "שנה",
  all:    "הכל",
  custom: "מותאם אישית",
};

function toLocalISO(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

function computeRange(
  type: DateRangeType,
  ref: Date,
  custom: { start: string; end: string },
): DateRangeValue {
  if (type === "all") {
    return { type, start: "2000-01-01", end: "2100-01-01", label: "כל הזמנים" };
  }
  if (type === "custom") {
    return { type, start: custom.start, end: custom.end, label: "טווח מותאם אישית" };
  }
  if (type === "week") {
    const day = ref.getDay();
    const sun = new Date(ref); sun.setDate(ref.getDate() - day);
    const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
    const sameMonth = sun.getMonth() === sat.getMonth();
    const label = sameMonth
      ? `${sun.getDate()}–${sat.getDate()} ${HE_MONTHS[sun.getMonth()]} ${sun.getFullYear()}`
      : `${sun.getDate()} ${HE_MONTHS[sun.getMonth()]} – ${sat.getDate()} ${HE_MONTHS[sat.getMonth()]} ${sat.getFullYear()}`;
    return { type, start: toLocalISO(sun), end: toLocalISO(sat), label };
  }
  if (type === "month") {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return {
      type,
      start: toLocalISO(start),
      end:   toLocalISO(end),
      label: `${HE_MONTHS[start.getMonth()]} ${start.getFullYear()}`,
    };
  }
  // year
  const start = new Date(ref.getFullYear(), 0, 1);
  const end   = new Date(ref.getFullYear(), 11, 31);
  return { type, start: toLocalISO(start), end: toLocalISO(end), label: `${ref.getFullYear()}` };
}

function shiftDate(type: DateRangeType, ref: Date, dir: 1 | -1): Date {
  const d = new Date(ref);
  if (type === "week")  d.setDate(d.getDate() + dir * 7);
  if (type === "month") d.setMonth(d.getMonth() + dir);
  if (type === "year")  d.setFullYear(d.getFullYear() + dir);
  return d;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DateRangePicker({
  availableTypes = ["week", "month", "year"],
  defaultType = "month",
  onChange,
  showArrows = true,
  showTodayButton = true,
  className = "",
}: DateRangePickerProps) {
  const [type, setType]       = useState<DateRangeType>(defaultType);
  const [refDate, setRefDate] = useState(() => new Date());
  const [custom, setCustom]   = useState({ start: "", end: "" });

  // Keep a stable ref to onChange so the effect doesn't need it as a dependency
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    onChangeRef.current(computeRange(type, refDate, custom));
  }, [type, refDate, custom]);

  function handleTypeChange(newType: DateRangeType) {
    setType(newType);
    setRefDate(new Date());
  }

  const isNavigable = type !== "all" && type !== "custom";
  const currentLabel = computeRange(type, refDate, custom).label;

  return (
    <div className={`flex items-center gap-2 ${className}`} dir="rtl">

      {/* Range type selector — hidden when only one type available */}
      {availableTypes.length > 1 && (
        <Select
          value={type}
          onChange={e => handleTypeChange(e.target.value as DateRangeType)}
        >
          {availableTypes.map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </Select>
      )}

      {/* ── Navigable modes: week / month / year ── */}
      {isNavigable && (
        <>
          {showArrows && (
            <Button
              variant="ghost"
              onClick={() => setRefDate(d => shiftDate(type, d, 1))}
              className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600"
              title="קודם"
            >
              <ChevronRight size={16} />
            </Button>
          )}

          {/* Inline label / editors */}
          {type === "month" ? (
            <div className="flex items-center gap-1">
              <Select
                value={refDate.getMonth()}
                onChange={e => {
                  const d = new Date(refDate);
                  d.setDate(1);
                  d.setMonth(parseInt(e.target.value));
                  setRefDate(d);
                }}
              >
                {HE_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </Select>
              <input
                type="number"
                value={refDate.getFullYear()}
                onChange={e => {
                  const d = new Date(refDate);
                  d.setFullYear(parseInt(e.target.value));
                  setRefDate(d);
                }}
                className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-sm font-bold text-slate-700 text-center outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          ) : type === "year" ? (
            <input
              type="number"
              value={refDate.getFullYear()}
              onChange={e => {
                const d = new Date(refDate);
                d.setFullYear(parseInt(e.target.value));
                setRefDate(d);
              }}
              className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-sm font-bold text-slate-700 text-center outline-none focus:ring-2 focus:ring-blue-200"
            />
          ) : (
            /* week — just a read-only label */
            <span className="text-sm font-semibold text-slate-700 min-w-[160px] text-center">
              {currentLabel}
            </span>
          )}

          {showArrows && (
            <Button
              variant="ghost"
              onClick={() => setRefDate(d => shiftDate(type, d, -1))}
              className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600"
              title="הבא"
            >
              <ChevronLeft size={16} />
            </Button>
          )}

          {showTodayButton && (
            <Button
              variant="ghost"
              onClick={() => setRefDate(new Date())}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold"
            >
              היום
            </Button>
          )}
        </>
      )}

      {/* ── Custom range: two date inputs ── */}
      {type === "custom" && (
        <>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">מ:</span>
            <input
              type="date"
              value={custom.start}
              onChange={e => setCustom(p => ({ ...p, start: e.target.value }))}
              className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">עד:</span>
            <input
              type="date"
              value={custom.end}
              onChange={e => setCustom(p => ({ ...p, end: e.target.value }))}
              className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </>
      )}

      {/* ── All time: informational label ── */}
      {type === "all" && (
        <span className="text-sm font-medium text-slate-500 px-2">מציג את כל הנתונים</span>
      )}
    </div>
  );
}
