"use client";
import { useState } from "react";
import ShiftTypeTable, { attrToBadgeColor, ToggleSwitch } from "@/components/ShiftTypeTable";
import type { ScheduleOn } from "@/lib/types";
import { useShiftTypes } from "@/hooks/useShiftTypes";
import { useDayTypes } from "@/hooks/useDayTypes";
import DayTypeManager from "@/components/DayTypeManager";
import CalendarConfigurator from "@/components/CalendarConfigurator";

export default function ShiftTypesPage() {
  const {
    shiftTypes, columnHeaders, loading, error,
    updateShiftType, setDesired, createShiftType, deleteShiftType, loadDefaults, reload,
  } = useShiftTypes();
  const {
    dayTypes, loading: dayTypesLoading,
    createDayType: createDayTypeAction, deleteDayType: deleteDayTypeAction, updateDayType: updateDayTypeAction
  } = useDayTypes();

  // ── Load Defaults state ───────────────────────────────────────────────────
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const [defaultsSuccess, setDefaultsSuccess] = useState<string | null>(null);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);

  const handleLoadDefaults = async () => {
    setDefaultsLoading(true);
    setDefaultsSuccess(null);
    setDefaultsError(null);
    try {
      const result = await loadDefaults();
      setDefaultsSuccess(`נטענו ${result.imported} סוגי משמרות ברירת מחדל`);
      if (result.warnings.length > 0) setDefaultsSuccess(`נטענו ${result.imported} משמרות (${result.warnings.length} תכונות לא נמצאו)`);
    } catch (e) {
      setDefaultsError((e as Error).message);
    } finally {
      setDefaultsLoading(false);
    }
  };

  // ── Manual Add state ──────────────────────────────────────────────────────
  const [newNames, setNewNames] = useState("");
  const [selectedAttrs, setSelectedAttrs] = useState<Set<string>>(new Set());
  const [newScheduleOn, setNewScheduleOn] = useState<ScheduleOn>(["all"]);
  const [newIsDesired, setNewIsDesired] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  const toggleAttr = (attr: string) => {
    setSelectedAttrs((prev) => {
      const next = new Set(prev);
      next.has(attr) ? next.delete(attr) : next.add(attr);
      return next;
    });
  };

  const toggleScheduleOn = (val: string) => {
    setNewScheduleOn((prev) => {
      if (val === "all") return ["all"];
      const next = prev.filter(v => v !== "all");
      let result: string[];
      if (next.includes(val)) {
        result = next.filter(v => v !== val);
      } else {
        result = [...next, val];
      }

      if (result.length === 0) return ["all"];

      // Check if "everything" is selected
      const allSpecific = ["weekdays", "friday", "weekend", ...dayTypes.map(dt => dt.id)];
      const hasAllSpecific = allSpecific.every(opt => result.includes(opt));
      if (hasAllSpecific) return ["all"];

      return result;
    });
  };

  const handleAdd = async () => {
    const names = newNames.split(",").map((n) => n.trim()).filter(Boolean);
    if (!names.length) { setAddError("יש להזין שם משמרת"); return; }
    setAddLoading(true);
    setAddError(null);
    try {
      await createShiftType({
        names,
        required_attributes: Array.from(selectedAttrs),
        schedule_on: newScheduleOn,
        is_desired: newIsDesired,
      });
      setNewNames("");
      setSelectedAttrs(new Set());
      setNewScheduleOn(["all"]);
      setNewIsDesired(false);
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">סוגי משמרות</h1>
          <p className="text-slate-500 mt-1 text-sm">
            הוסף ידנית או ערוך שמות ישירות בטבלה. סמן{" "}
            <span className="text-amber-600 font-semibold">רצוי ★</span> למשמרות שיחולקו באופן שווה.
          </p>
        </div>
        {/* Load Defaults button */}
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={handleLoadDefaults}
            disabled={defaultsLoading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 shadow-sm transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
            </svg>
            {defaultsLoading ? "טוען..." : "טען ברירת מחדל"}
          </button>
          {defaultsSuccess && (
            <p className="text-xs text-green-600 font-medium">{defaultsSuccess}</p>
          )}
          {defaultsError && (
            <p className="text-xs text-red-600 font-medium">{defaultsError}</p>
          )}
        </div>
      </div>

      {/* ── Day Types & Calendar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DayTypeManager
          dayTypes={dayTypes}
          loading={dayTypesLoading}
          createDayType={createDayTypeAction}
          deleteDayType={deleteDayTypeAction}
          updateDayType={updateDayTypeAction}
        />
        <CalendarConfigurator dayTypes={dayTypes} />
      </div>

      {/* ── Manual Add ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">הוסף סוג משמרת ידנית</h2>
        </div>
        <div className="p-6 space-y-5">
          {/* Name input */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">שם משמרת</label>
            <input
              dir="rtl"
              type="text"
              placeholder="לדוגמה: 15, 15א׳, 19 (מופרדים בפסיק)"
              value={newNames}
              onChange={(e) => setNewNames(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
            />
          </div>

          {/* Attribute checkboxes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">תכונות נדרשות</label>
            {columnHeaders.length === 0 ? (
              <p className="text-xs text-slate-400 italic bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                ייבא קובץ עובדים תחילה כדי לראות את שמות התכונות
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {columnHeaders.map((header, i) => {
                  const attr = `col_${i + 1}`;
                  const checked = selectedAttrs.has(attr);
                  return (
                    <label
                      key={attr}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-xs font-semibold select-none ${checked
                          ? `${attrToBadgeColor(attr)} border-current shadow-sm`
                          : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAttr(attr)}
                        className="sr-only"
                      />
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-current border-current" : "border-slate-300 bg-white"}`}>
                        {checked && (
                          <svg viewBox="0 0 10 10" fill="white" className="w-2.5 h-2.5">
                            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          </svg>
                        )}
                      </span>
                      {header}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Day scope + desired row */}
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">ימי תזמון</label>
              <div className="flex gap-1.5 flex-wrap">
                {(() => {
                  const staticOpts = [
                    { value: "all", label: "כל הימים", color: "bg-white text-slate-500 border-slate-200 hover:bg-slate-50", active: "bg-slate-600 text-white border-slate-600" },
                    { value: "weekdays", label: "ימי חול", color: "bg-white text-slate-500 border-slate-200 hover:bg-slate-50", active: "bg-blue-600 text-white border-blue-600" },
                    { value: "friday", label: "שישי", color: "bg-white text-slate-500 border-slate-200 hover:bg-slate-50", active: "bg-orange-600 text-white border-orange-600" },
                    { value: "weekend", label: "סוף שבוע", color: "bg-white text-slate-500 border-slate-200 hover:bg-slate-50", active: "bg-purple-600 text-white border-purple-600" },
                  ];
                  const dynamicOpts = dayTypes.map(dt => ({
                    value: dt.id,
                    label: dt.name,
                    color: "bg-white text-slate-500 border-slate-200 hover:bg-slate-50",
                    active: dt.color.replace("100", "600").replace(/text-[a-z]+-800/, "text-white").replace(/border-[a-z]+-200/, `border-${dt.color.split("-")[1]}-600`)
                  }));
                  return [...staticOpts, ...dynamicOpts].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleScheduleOn(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${newScheduleOn.includes(opt.value) ? opt.active + " shadow-sm border-current" : opt.color + " border-transparent hover:bg-slate-100"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ));
                })()}
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <ToggleSwitch
                checked={newIsDesired}
                onChange={() => setNewIsDesired((v) => !v)}
              />
              <span className="text-sm text-slate-600 font-medium">משמרת רצויה ★</span>
            </label>
          </div>

          {/* Error + Add button */}
          {addError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {addError}
            </div>
          )}
          <button
            type="button"
            onClick={handleAdd}
            disabled={addLoading}
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
          >
            {addLoading ? "מוסיף..." : "+ הוסף משמרת"}
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl shimmer" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{error}</div>
      ) : (
        <ShiftTypeTable
          shiftTypes={shiftTypes}
          columnHeaders={columnHeaders}
          onUpdate={updateShiftType}
          onToggleDesired={setDesired}
          onDelete={deleteShiftType}
          dayTypes={dayTypes}
        />
      )}
    </div>
  );
}
