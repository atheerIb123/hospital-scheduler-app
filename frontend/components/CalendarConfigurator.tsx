"use client";
import { useState } from "react";
import { useDaySettings } from "@/hooks/useDaySettings";
import { DayType } from "@/lib/types";

interface Props {
  dayTypes: DayType[];
}

const MONTH_NAMES = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const DAY_NAMES = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HEBREW_MONTH_FORMATTER = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long' });

function toHebrewNumeral(n: number): string {
  const units = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל"];
  if (n === 15) return "טו";
  if (n === 16) return "טז";
  return tens[Math.floor(n / 10)] + units[n % 10];
}

export default function CalendarConfigurator({ dayTypes }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { settings, setOverride, loading } = useDaySettings(year, month);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Calculate first day of month (0 = Sunday, 1 = Monday...)
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  // We want Sunday (0) to be the first column on the right.
  // In a grid-cols-7 with dir="rtl", index 0 is on the right.
  const paddingCells = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const dayTypeOverrides: Record<string, string> = {};
  for (const s of settings) {
    dayTypeOverrides[s.date] = s.day_type_id;
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-semibold text-slate-800">הגדרת מבנה ימים (חגים/מיוחדים)</h2>

        <div className="flex items-center gap-2">
          <select
            className="text-xs font-semibold border-none bg-slate-50 rounded-lg px-2 py-1 focus:ring-0"
            value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
          </select>
          <select
            className="text-xs font-semibold border-none bg-slate-50 rounded-lg px-2 py-1 focus:ring-0"
            value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 28 }).map((_, i) => <div key={i} className="h-12 rounded-lg shimmer" />)}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2" dir="rtl">
            {/* Weekday Headers */}
            {DAY_NAMES.map(name => (
              <div key={name} className="text-center text-[10px] font-bold text-slate-400 pb-1">
                {name}
              </div>
            ))}

            {/* Padding for first day of month */}
            {paddingCells.map(i => (
              <div key={`pad-${i}`} className="h-12 bg-slate-50/30 rounded-lg border border-slate-50" />
            ))}

            {days.map(day => {
              const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const currentTypeId = dayTypeOverrides[dateStr];
              const d = new Date(year, month - 1, day).getDay();
              const isWeekend = d === 5 || d === 6;
              const activeType = dayTypes.find(dt => dt.id === currentTypeId);

              const dateObj = new Date(year, month - 1, day);
              const hMonth = HEBREW_MONTH_FORMATTER.format(dateObj);
              // Extract day from Intl but then override with our numeral
              const hDayNum = parseInt(new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric' }).format(dateObj));
              const hebrewDate = `${toHebrewNumeral(hDayNum)} ב${hMonth}`;

              return (
                <DayCell
                  key={day}
                  day={day}
                  dayName={DAY_NAMES[d]}
                  hebrewDate={hebrewDate}
                  isWeekend={isWeekend}
                  activeType={activeType}
                  dayTypes={dayTypes}
                  onSelect={(typeId) => setOverride(dateStr, typeId)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DayCell({ day, dayName, hebrewDate, isWeekend, activeType, dayTypes, onSelect }: {
  day: number;
  dayName: string;
  hebrewDate: string;
  isWeekend: boolean;
  activeType?: DayType;
  dayTypes: DayType[];
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div
        onClick={() => setOpen(!open)}
        className={`cursor-pointer p-2 rounded-xl border transition-all flex flex-col items-center justify-center min-h-[56px] ${activeType
            ? activeType.color.replace("100", "600").replace(/text-[a-z]+-800/, "text-white").replace(/border-[a-z]+-200/, `border-${activeType.color.split("-")[1]}-600`) + " border-current shadow-sm"
            : isWeekend
              ? "bg-slate-50 border-slate-100 text-slate-400"
              : "bg-white border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 text-slate-600"
          }`}
      >
        <div className="flex w-full justify-between items-start px-1">
          <span className="text-xs font-bold leading-none">{day}</span>
          <span className="text-[9px] font-medium text-slate-500 leading-none">{hebrewDate}</span>
        </div>
        <span className={`text-[10px] mt-1 ${activeType ? "font-bold text-white uppercase" : "opacity-70 font-medium"}`}>
          {activeType ? activeType.name : dayName}
        </span>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 flex flex-col gap-0.5 w-32 animate-in fade-in zoom-in-95 slide-in-from-bottom-2">
            <p className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase text-center border-b border-slate-50 mb-1">סוג יום</p>
            <button
              onClick={() => { onSelect(null); setOpen(false); }}
              className="w-full text-right px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50 text-slate-500 transition-colors"
            >
              רגיל
            </button>
            {dayTypes.map((dt) => (
              <button
                key={dt.id}
                onClick={() => { onSelect(dt.id); setOpen(false); }}
                className={`w-full text-right px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeType?.id === dt.id
                    ? `${dt.color.replace("100", "600").replace(/text-[a-z]+-800/, "text-white").replace(/border-[a-z]+-200/, `border-${dt.color.split("-")[1]}-600`)} shadow-sm border border-current`
                    : "text-slate-500 hover:bg-slate-50"
                  }`}
              >
                {dt.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
