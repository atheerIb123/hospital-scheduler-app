"use client";
import { useState, useMemo, useEffect } from "react";
import ShiftTypeTable, { attrToBadgeColor, DesirabilityStars, DESIRABILITY_LABELS, DESIRABILITY_POINTS } from "@/components/ShiftTypeTable";
import type { ScheduleOn } from "@/lib/types";
import { useShiftTypes } from "@/hooks/useShiftTypes";
import { useDayTypes } from "@/hooks/useDayTypes";
import DayTypeManager from "@/components/DayTypeManager";
import CalendarConfigurator from "@/components/CalendarConfigurator";
import WeekdayScoreManager from "@/components/WeekdayScoreManager";
import { ShiftCard, Stepper } from "@/components/ShiftCompositionConfig";
import type { RoleSlot } from "@/lib/types";
import SpecialShiftMonthlyConfig from "@/components/SpecialShiftMonthlyConfig";
import ShiftInstanceOverrides from "@/components/ShiftInstanceOverrides";
import { useShiftComposition } from "@/hooks/useShiftComposition";
import { useMode } from "@/components/ModeProvider";

const TABS = [
  { id: "types",       label: "סוגי משמרות" },
  { id: "specifics",   label: "ספציפיקציות" },
] as const;
type TabId = typeof TABS[number]["id"];

// ── Composition Modal ─────────────────────────────────────────────────────────
function CompositionModal({
  shiftName,
  onClose,
  shiftTypes,
  columnHeaders,
  compositionData,
  onSave
}: {
  shiftName: string;
  onClose: () => void;
  shiftTypes: any[];
  columnHeaders: string[];
  compositionData: any;
  onSave: (configs: any[]) => Promise<void>;
}) {
  const [config, setConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (compositionData) {
      const found = compositionData.shift_configs.find((c: any) => c.shift_name === shiftName);
      setConfig(found || {
        shift_name: shiftName,
        hours: "",
        total_workers: 4,
        role_slots: [],
        min_male: 0,
        min_female: 0
      });
    }
  }, [compositionData, shiftName]);

  const handleSave = async (newConfig: any = config) => {
    if (!compositionData) return;
    setSaving(true);
    try {
      const otherConfigs = compositionData.shift_configs.filter((c: any) => c.shift_name !== shiftName);
      // If newConfig is null, we are deleting/resetting
      const newConfigs = newConfig ? [...otherConfigs, newConfig] : otherConfigs;
      await onSave(newConfigs);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!config) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <h3 className="font-bold text-lg text-slate-800">הרכב משמרת: {shiftName}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="p-4">
          <ShiftCard
            config={config}
            shiftType={shiftTypes.find(st => st.names.includes(shiftName))}
            columnHeaders={columnHeaders}
            onChange={setConfig}
            onDelete={() => { if (confirm("לאפס את הרכב המשמרת לברירת מחדל?")) handleSave(null); }}
          />
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">ביטול</button>
            <button onClick={() => handleSave()} disabled={saving} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
              {saving ? "שומר..." : "שמור שינויים"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShiftTypesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("types");
  const { mode } = useMode();
  const isNursing = mode.startsWith("nursing");

  const {
    shiftTypes, columnHeaders, loading, error,
    updateShiftType, createShiftType, deleteShiftType, deleteAllShiftTypes, loadDefaults, reload,
  } = useShiftTypes();
  const {
    dayTypes, loading: dayTypesLoading,
    createDayType: createDayTypeAction, deleteDayType: deleteDayTypeAction, updateDayType: updateDayTypeAction
  } = useDayTypes();

  const { data: compositionData, loading: compositionLoading, seedNursing, save: saveComposition } = useShiftComposition();
  const [seedingNursing, setSeedingNursing] = useState(false);

  const handleSeedNursing = async () => {
    if (!window.confirm("פעולה זו תאפס את כל סוגי המשמרות לברירות המחדל של סיעוד. להמשיך?")) return;
    setSeedingNursing(true);
    try { await seedNursing(); await reload(); }
    catch { /* ignore */ }
    finally { setSeedingNursing(false); }
  };

  const [deletingAll, setDeletingAll] = useState(false);
  const handleDeleteAll = async () => {
    if (!window.confirm("למחוק את כל סוגי המשמרות? פעולה זו אינה הפיכה.")) return;
    setDeletingAll(true);
    try { await deleteAllShiftTypes(); }
    catch { /* ignore */ }
    finally { setDeletingAll(false); }
  };


  // ── Shift type filter state ───────────────────────────────────────────────
  const [shiftSearch, setShiftSearch] = useState("");
  const [shiftDesFilter, setShiftDesFilter] = useState<Set<number>>(new Set());
  const [shiftAttrFilter, setShiftAttrFilter] = useState<Set<string>>(new Set());
  const [shiftSpecialFilter, setShiftSpecialFilter] = useState(false);
  const [shiftDayFilter, setShiftDayFilter] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  // Composition filters
  const [compRoleFilter, setCompRoleFilter] = useState<Set<string>>(new Set()); // filter by role slot attribute name
  const [compRoleMode, setCompRoleMode] = useState<"or" | "and">("or"); // OR = any role, AND = all roles
  const [compMinWorkers, setCompMinWorkers] = useState<number | "">("");
  const [compMaxWorkers, setCompMaxWorkers] = useState<number | "">("");
  const [compGenderFilter, setCompGenderFilter] = useState<"" | "male" | "female">("");

  const toggleRoleFilter = (r: string) => setCompRoleFilter(prev => { const s = new Set(prev); s.has(r) ? s.delete(r) : s.add(r); return s; });

  const clearAllFilters = () => {
    setShiftSearch("");
    setShiftDesFilter(new Set());
    setShiftAttrFilter(new Set());
    setShiftDayFilter(new Set());
    setShiftSpecialFilter(false);
    setCompRoleFilter(new Set());
    setCompMinWorkers("");
    setCompMaxWorkers("");
    setCompGenderFilter("");
  };

  const toggleDesFil = (n: number) => setShiftDesFilter(prev => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });
  const toggleAttrFil = (a: string) => setShiftAttrFilter(prev => { const s = new Set(prev); s.has(a) ? s.delete(a) : s.add(a); return s; });
  const toggleDayFil = (v: string) => setShiftDayFilter(prev => { const s = new Set(prev); s.has(v) ? s.delete(v) : s.add(v); return s; });

  const activeFilterCount =
    (shiftSearch ? 1 : 0) +
    shiftDesFilter.size +
    shiftAttrFilter.size +
    shiftDayFilter.size +
    (shiftSpecialFilter ? 1 : 0) +
    compRoleFilter.size +
    (compMinWorkers !== "" ? 1 : 0) +
    (compMaxWorkers !== "" ? 1 : 0) +
    (compGenderFilter ? 1 : 0);

  const filteredShiftTypes = useMemo(() => {
    const configs = compositionData?.shift_configs ?? [];
    const q = shiftSearch.trim().toLowerCase();
    return shiftTypes.filter(st => {
      if (q && !st.names.some(n => n.toLowerCase().includes(q))) return false;
      if (shiftSpecialFilter && !st.is_special) return false;
      if (shiftDesFilter.size > 0 && !shiftDesFilter.has(Number(st.desirability ?? 3))) return false;
      if (shiftAttrFilter.size > 0 && ![...shiftAttrFilter].some(a => st.required_attributes.includes(a))) return false;
      if (shiftDayFilter.size > 0) {
        const days: string[] = Array.isArray(st.schedule_on) ? st.schedule_on : [st.schedule_on ?? "all"];
        if (!days.includes("all") && ![...shiftDayFilter].some(d => days.includes(d))) return false;
      }

      // Composition filters — find the config for this shift type
      const hasCompFilter = compRoleFilter.size > 0 || compMinWorkers !== "" || compMaxWorkers !== "" || compGenderFilter;
      if (hasCompFilter) {
        const cfg = configs.find(c => st.names.includes(c.shift_name));
        if (!cfg) return false; // no composition defined → excluded when filtering by composition
        if (compRoleFilter.size > 0) {
          const roleMatch = compRoleMode === "and"
            ? [...compRoleFilter].every(r => cfg.role_slots.some(s => s.attribute_name === r))
            : [...compRoleFilter].some(r => cfg.role_slots.some(s => s.attribute_name === r));
          if (!roleMatch) return false;
        }
        if (compMinWorkers !== "" && cfg.total_workers < compMinWorkers) return false;
        if (compMaxWorkers !== "" && cfg.total_workers > compMaxWorkers) return false;
        if (compGenderFilter === "male"   && cfg.min_male   < 1) return false;
        if (compGenderFilter === "female" && cfg.min_female < 1) return false;
      }

      return true;
    });
  }, [shiftTypes, shiftSearch, shiftDesFilter, shiftAttrFilter, shiftDayFilter, shiftSpecialFilter,
      compositionData, compRoleFilter, compRoleMode, compMinWorkers, compMaxWorkers, compGenderFilter]);

  // ── Day type filter state ─────────────────────────────────────────────────
  const [dtSearch, setDtSearch] = useState("");
  const [dtMinScore, setDtMinScore] = useState<number | "">("");

  const filteredDayTypes = useMemo(() =>
    dayTypes.filter(dt => {
      if (dtSearch.trim() && !dt.name.includes(dtSearch.trim())) return false;
      if (dtMinScore !== "" && (dt.score ?? 0) < dtMinScore) return false;
      return true;
    }),
  [dayTypes, dtSearch, dtMinScore]);

  // ── Load Defaults state ───────────────────────────────────────────────────
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const [defaultsSuccess, setDefaultsSuccess] = useState<string | null>(null);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);

  const handleLoadDefaults = async () => {
    if (isNursing && !window.confirm("פעולה זו תטען את ברירות המחדל ותחליף משמרות קיימות. להמשיך?")) return;
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
  const [newDesirability, setNewDesirability] = useState(3);
  const [newIsSpecial, setNewIsSpecial] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Composition fields for new shift
  const [newHours, setNewHours] = useState("");
  const [newTotalWorkers, setNewTotalWorkers] = useState(4);
  const [newRoleSlots, setNewRoleSlots] = useState<RoleSlot[]>([]);
  const [newMinMale, setNewMinMale] = useState(0);
  const [newMinFemale, setNewMinFemale] = useState(0);

  const addRoleSlot = (attrName: string) =>
    setNewRoleSlots(prev => [...prev, { attribute_name: attrName, count: 1 }]);
  const removeRoleSlot = (idx: number) =>
    setNewRoleSlots(prev => prev.filter((_, i) => i !== idx));
  const updateRoleSlot = (idx: number, patch: Partial<RoleSlot>) =>
    setNewRoleSlots(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

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
        desirability: newDesirability,
        is_special: newIsSpecial,
      });

      // Save composition entry for this shift (nursing only)
      if (isNursing) {
        const primaryName = names[0];
        const currentConfigs = compositionData?.shift_configs ?? [];
        const newConfig = {
          shift_name: primaryName,
          hours: newHours,
          total_workers: newTotalWorkers,
          role_slots: newRoleSlots,
          min_male: newMinMale,
          min_female: newMinFemale,
        };
        await saveComposition([...currentConfigs, newConfig]);
      }

      setNewNames("");
      setSelectedAttrs(new Set());
      setNewScheduleOn(["all"]);
      setNewDesirability(3);
      setNewIsSpecial(false);
      setNewHours("");
      setNewTotalWorkers(4);
      setNewRoleSlots([]);
      setNewMinMale(0);
      setNewMinFemale(0);
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAddLoading(false);
    }
  };

  // ── Non-nursing (doctors) view — matches main branch layout ─────────────
  if (!isNursing) {
    return (
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">סוגי משמרות</h1>
            <p className="text-slate-500 mt-1 text-sm">
              הוסף ידנית או ערוך שמות ישירות בטבלה. קבע{" "}
              <span className="text-amber-600 font-semibold">ניקוד רצוי ★★★★★</span> — ★ = לא רצויה בכלל (10 נק׳ צדק), ★★ = 7 נק׳, ★★★ = 4 נק׳, ★★★★ = 2 נק׳, ★★★★★ = רצויה מאוד (1 נק׳ צדק). כל המשמרות יחולקו שווה בין העובדים.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button type="button" onClick={handleLoadDefaults} disabled={defaultsLoading}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 shadow-sm transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
              </svg>
              {defaultsLoading ? "טוען..." : "טען ברירת מחדל"}
            </button>
            {defaultsSuccess && <p className="text-xs text-green-600 font-medium">{defaultsSuccess}</p>}
            {defaultsError && <p className="text-xs text-red-600 font-medium">{defaultsError}</p>}
          </div>
        </div>

        {/* Day types filter */}
        <div className="flex items-center gap-3 flex-wrap bg-slate-50/60 rounded-xl px-4 py-2.5 border border-slate-100">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-400 shrink-0">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd"/>
          </svg>
          <input type="text" value={dtSearch} onChange={e => setDtSearch(e.target.value)}
            placeholder="סנן מבנה יום לפי שם..."
            className="border border-slate-200 rounded-xl px-3 py-1 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">ציון מינימום</span>
            <input type="number" min={0} value={dtMinScore}
              onChange={e => setDtMinScore(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
              className="w-16 border border-slate-200 rounded-xl px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white" />
          </div>
          {(dtSearch || dtMinScore !== "") && (
            <button type="button" onClick={() => { setDtSearch(""); setDtMinScore(""); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors">נקה</button>
          )}
          <span className="text-xs text-slate-400 mr-auto">{filteredDayTypes.length}/{dayTypes.length} סוגים</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DayTypeManager dayTypes={filteredDayTypes} loading={dayTypesLoading}
            createDayType={createDayTypeAction} deleteDayType={deleteDayTypeAction} updateDayType={updateDayTypeAction} />
          <CalendarConfigurator dayTypes={filteredDayTypes} allDayTypes={dayTypes} />
        </div>

        <WeekdayScoreManager />

        {/* Manual Add */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">הוסף סוג משמרת ידנית</h2>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">שם משמרת</label>
              <input dir="rtl" type="text" placeholder="לדוגמה: 15, 15א׳, 19 (מופרדים בפסיק)"
                value={newNames} onChange={e => setNewNames(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">תכונות נדרשות</label>
              {columnHeaders.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">ייבא קובץ עובדים תחילה כדי לראות את שמות התכונות</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {columnHeaders.map((header, i) => {
                    const attr = `col_${i + 1}`;
                    const checked = selectedAttrs.has(attr);
                    return (
                      <label key={attr} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-xs font-semibold select-none ${checked ? `${attrToBadgeColor(attr)} border-current shadow-sm` : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleAttr(attr)} className="sr-only" />
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-current border-current" : "border-slate-300 bg-white"}`}>
                          {checked && <svg viewBox="0 0 10 10" fill="white" className="w-2.5 h-2.5"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>}
                        </span>
                        {header}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
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
                      value: dt.id, label: dt.name,
                      color: "bg-white text-slate-500 border-slate-200 hover:bg-slate-50",
                      active: dt.color.replace("100", "600").replace(/text-[a-z]+-800/, "text-white").replace(/border-[a-z]+-200/, `border-${dt.color.split("-")[1]}-600`)
                    }));
                    return [...staticOpts, ...dynamicOpts].map(opt => (
                      <button key={opt.value} type="button" onClick={() => toggleScheduleOn(opt.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${newScheduleOn.includes(opt.value) ? opt.active + " shadow-sm border-current" : opt.color + " border-transparent hover:bg-slate-100"}`}>
                        {opt.label}
                      </button>
                    ));
                  })()}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">
                  ניקוד רצוי
                  <span className="mr-2 font-normal text-slate-400">({DESIRABILITY_LABELS[newDesirability]} · {DESIRABILITY_POINTS[newDesirability]} נק׳ צדק)</span>
                </label>
                <DesirabilityStars value={newDesirability} onChange={setNewDesirability} />
              </div>
            </div>
            {addError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{addError}</div>}
            <button type="button" onClick={handleAdd} disabled={addLoading}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm">
              {addLoading ? "מוסיף..." : "+ הוסף משמרת"}
            </button>
          </div>
        </div>

        {/* Shift types filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd"/>
              </svg>
              <input type="text" value={shiftSearch} onChange={e => setShiftSearch(e.target.value)}
                placeholder="חיפוש לפי שם משמרת..."
                className="border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => toggleDesFil(n)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${shiftDesFilter.has(n) ? "bg-amber-400 text-white border-amber-400 shadow-sm" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"}`}>
                  {"★".repeat(n)}
                </button>
              ))}
            </div>
            {(shiftSearch || shiftDesFilter.size > 0 || shiftAttrFilter.size > 0 || shiftDayFilter.size > 0) && (
              <button type="button" onClick={() => { setShiftSearch(""); setShiftDesFilter(new Set()); setShiftAttrFilter(new Set()); setShiftDayFilter(new Set()); }}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors">נקה הכל</button>
            )}
            <span className="text-xs text-slate-400 mr-auto">{filteredShiftTypes.length}/{shiftTypes.length} משמרות</span>
          </div>
          {columnHeaders.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 self-center ml-1">תכונה:</span>
              {columnHeaders.map((h, i) => {
                const attr = `col_${i+1}`;
                const active = shiftAttrFilter.has(attr);
                return (
                  <button key={attr} type="button" onClick={() => toggleAttrFil(attr)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${active ? `${attrToBadgeColor(attr)} shadow-sm` : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                    {h}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-xs text-slate-400 self-center ml-1">ימים:</span>
            {[
              { value: "all", label: "כל הימים" },
              { value: "weekdays", label: "ימי חול" },
              { value: "friday", label: "שישי" },
              { value: "weekend", label: "סוף שבוע" },
              ...dayTypes.map(dt => ({ value: dt.id, label: dt.name })),
            ].map(opt => {
              const active = shiftDayFilter.has(opt.value);
              return (
                <button key={opt.value} type="button" onClick={() => toggleDayFil(opt.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${active ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 rounded-xl shimmer" />)}</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{error}</div>
        ) : (
          <ShiftTypeTable
            shiftTypes={filteredShiftTypes}
            columnHeaders={columnHeaders}
            onUpdate={updateShiftType}
            onDelete={deleteShiftType}
            dayTypes={dayTypes}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">סוגי משמרות</h1>
          <p className="text-slate-500 mt-1 text-sm">
            הגדר סוגי משמרות, הרכב עובדים, ועקיפות חודשיות
          </p>
        </div>
        {activeTab === "types" && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              {isNursing && (
                <button
                  type="button"
                  onClick={handleSeedNursing}
                  disabled={seedingNursing}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 shadow-sm transition-all"
                >
                  {seedingNursing ? "טוען..." : "טען ברירת מחדל סיעוד"}
                </button>
              )}
              {!isNursing && (
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
              )}
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={deletingAll || shiftTypes.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 shadow-sm transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                </svg>
                {deletingAll ? "מוחק..." : "מחק הכל"}
              </button>
            </div>
            {defaultsSuccess && <p className="text-xs text-green-600 font-medium">{defaultsSuccess}</p>}
            {defaultsError && <p className="text-xs text-red-600 font-medium">{defaultsError}</p>}
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === tab.id
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ Tab: סוגי משמרות ══ */}
      {activeTab === "types" && (
        <>
          {/* ── Shift Types Filter ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Filter bar (always visible) */}
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd"/>
                </svg>
                <input type="text" value={shiftSearch} onChange={e => setShiftSearch(e.target.value)}
                  placeholder="חיפוש לפי שם..."
                  className="border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>

              {/* Toggle advanced filters */}
              <button type="button" onClick={() => setFilterOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filterOpen ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M14 2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v.763a1 1 0 0 0 .293.707l3.914 3.914A1 1 0 0 1 6.5 8.09V13.5a.5.5 0 0 0 .724.447l2.5-1.25A.5.5 0 0 0 10 12.25V8.09a1 1 0 0 1 .293-.706l3.914-3.914A1 1 0 0 0 14 2.763V2Z" />
                </svg>
                סינון מתקדם
                {activeFilterCount > 0 && (
                  <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">{activeFilterCount}</span>
                )}
              </button>

              {activeFilterCount > 0 && (
                <button type="button" onClick={clearAllFilters}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                  נקה סינון
                </button>
              )}

              <span className="text-xs text-slate-400 mr-auto">
                {activeFilterCount > 0
                  ? <><span className="font-semibold text-blue-600">{filteredShiftTypes.length}</span> מתוך {shiftTypes.length}</>
                  : <>{shiftTypes.length} משמרות</>
                }
              </span>
            </div>

            {/* Expanded filter panel */}
            {filterOpen && (
              <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50/50">
                {/* Desirability */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500 w-16 shrink-0">ניקוד:</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { n: 1, label: "לא רצויה בכלל", color: "bg-red-100 text-red-700 border-red-200" },
                      { n: 2, label: "לא רצויה",       color: "bg-orange-100 text-orange-700 border-orange-200" },
                      { n: 3, label: "ניטרלי",         color: "bg-slate-100 text-slate-600 border-slate-200" },
                      { n: 4, label: "רצויה",          color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
                      { n: 5, label: "רצויה מאוד",     color: "bg-amber-100 text-amber-700 border-amber-200" },
                    ].map(({ n, label, color }) => (
                      <button key={n} type="button" onClick={() => toggleDesFil(n)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 ${shiftDesFilter.has(n) ? color + " shadow-sm ring-1 ring-current" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"}`}>
                        {"★".repeat(n)} <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Special */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 w-16 shrink-0">סוג:</span>
                  <button type="button" onClick={() => setShiftSpecialFilter(p => !p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${shiftSpecialFilter ? "bg-purple-100 text-purple-700 border-purple-200 shadow-sm ring-1 ring-purple-300" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"}`}>
                    מיוחדת בלבד
                  </button>
                </div>

                {/* Attributes */}
                {columnHeaders.length > 0 && (
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 w-16 shrink-0 pt-1">תכונה:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {columnHeaders.map((h, i) => {
                        const attr = `col_${i+1}`;
                        const active = shiftAttrFilter.has(attr);
                        return (
                          <button key={attr} type="button" onClick={() => toggleAttrFil(attr)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${active ? `${attrToBadgeColor(attr)} shadow-sm ring-1 ring-current` : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"}`}>
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Days */}
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500 w-16 shrink-0 pt-1">ימים:</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { value: "weekdays", label: "ימי חול",   cls: "bg-blue-100 text-blue-700 border-blue-200" },
                      { value: "friday",   label: "שישי",       cls: "bg-orange-100 text-orange-700 border-orange-200" },
                      { value: "weekend",  label: "סוף שבוע",   cls: "bg-purple-100 text-purple-700 border-purple-200" },
                      ...dayTypes.map(dt => ({ value: dt.id, label: dt.name, cls: dt.color })),
                    ].map(opt => {
                      const active = shiftDayFilter.has(opt.value);
                      return (
                        <button key={opt.value} type="button" onClick={() => toggleDayFil(opt.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${active ? `${opt.cls} shadow-sm ring-1 ring-current` : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"}`}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Composition filters ── */}
                {(compositionData?.shift_configs ?? []).length > 0 && (
                  <>
                    <div className="h-px bg-slate-200 my-1" />

                    {/* Role slots */}
                    {columnHeaders.length > 0 && (
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-500 w-16 shrink-0 pt-1">תפקיד:</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {columnHeaders.map((h) => {
                            const active = compRoleFilter.has(h);
                            return (
                              <button key={h} type="button" onClick={() => toggleRoleFilter(h)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${active ? "bg-cyan-100 text-cyan-700 border-cyan-200 shadow-sm ring-1 ring-cyan-300" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"}`}>
                                {h}
                              </button>
                            );
                          })}
                          {compRoleFilter.size >= 2 && (
                            <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
                              <button type="button" onClick={() => setCompRoleMode("or")}
                                className={`px-2.5 py-1 transition-all ${compRoleMode === "or" ? "bg-slate-700 text-white" : "bg-white text-slate-400 hover:bg-slate-50"}`}>
                                או
                              </button>
                              <button type="button" onClick={() => setCompRoleMode("and")}
                                className={`px-2.5 py-1 transition-all border-r border-slate-200 ${compRoleMode === "and" ? "bg-slate-700 text-white" : "bg-white text-slate-400 hover:bg-slate-50"}`}>
                                גם
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Total workers range */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-500 w-16 shrink-0">עובדים:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">מ-</span>
                        <input type="number" min={1} max={30} value={compMinWorkers}
                          onChange={e => setCompMinWorkers(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
                          placeholder="—"
                          className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white" />
                        <span className="text-xs text-slate-400">עד</span>
                        <input type="number" min={1} max={30} value={compMaxWorkers}
                          onChange={e => setCompMaxWorkers(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
                          placeholder="—"
                          className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white" />
                        {(compMinWorkers !== "" || compMaxWorkers !== "") && (
                          <button type="button" onClick={() => { setCompMinWorkers(""); setCompMaxWorkers(""); }}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors">איפוס</button>
                        )}
                      </div>
                    </div>

                    {/* Gender requirements */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-500 w-16 shrink-0">מגדר:</span>
                      <div className="flex gap-1.5">
                        {[
                          { val: "male"   as const, label: "דורש גברים" },
                          { val: "female" as const, label: "דורש נשים"  },
                        ].map(({ val, label }) => (
                          <button key={val} type="button"
                            onClick={() => setCompGenderFilter(p => p === val ? "" : val)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${compGenderFilter === val ? "bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm ring-1 ring-indigo-300" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Active filter chips */}
            {activeFilterCount > 0 && !filterOpen && (
              <div className="border-t border-slate-100 px-4 py-2 flex gap-1.5 flex-wrap">
                {shiftSearch && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
                    "{shiftSearch}"
                    <button type="button" onClick={() => setShiftSearch("")} className="hover:text-red-500 transition-colors">×</button>
                  </span>
                )}
                {[...shiftDesFilter].map(n => (
                  <span key={n} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200">
                    {"★".repeat(n)}
                    <button type="button" onClick={() => toggleDesFil(n)} className="hover:text-red-500 transition-colors">×</button>
                  </span>
                ))}
                {shiftSpecialFilter && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-200">
                    מיוחדת
                    <button type="button" onClick={() => setShiftSpecialFilter(false)} className="hover:text-red-500 transition-colors">×</button>
                  </span>
                )}
                {[...shiftAttrFilter].map(attr => {
                  const idx = parseInt(attr.replace("col_", "")) - 1;
                  return (
                    <span key={attr} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${attrToBadgeColor(attr)}`}>
                      {columnHeaders[idx] ?? attr}
                      <button type="button" onClick={() => toggleAttrFil(attr)} className="hover:text-red-500 transition-colors">×</button>
                    </span>
                  );
                })}
                {[...shiftDayFilter].map(v => {
                  const label = v === "weekdays" ? "ימי חול" : v === "friday" ? "שישי" : v === "weekend" ? "סוף שבוע" : (dayTypes.find(d => d.id === v)?.name ?? v);
                  return (
                    <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
                      {label}
                      <button type="button" onClick={() => toggleDayFil(v)} className="hover:text-red-500 transition-colors">×</button>
                    </span>
                  );
                })}
                {[...compRoleFilter].map((r, i) => (
                  <span key={r} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-cyan-50 text-cyan-700 border border-cyan-200">
                    {i > 0 && <span className="font-bold text-cyan-400">{compRoleMode === "and" ? "+" : "|"}</span>}
                    {r}
                    <button type="button" onClick={() => toggleRoleFilter(r)} className="hover:text-red-500 transition-colors">×</button>
                  </span>
                ))}
                {(compMinWorkers !== "" || compMaxWorkers !== "") && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-600 border border-slate-200">
                    עובדים {compMinWorkers !== "" ? `מ-${compMinWorkers}` : ""}{compMaxWorkers !== "" ? ` עד ${compMaxWorkers}` : ""}
                    <button type="button" onClick={() => { setCompMinWorkers(""); setCompMaxWorkers(""); }} className="hover:text-red-500 transition-colors">×</button>
                  </span>
                )}
                {compGenderFilter && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {compGenderFilter === "male" ? "דורש גברים" : "דורש נשים"}
                    <button type="button" onClick={() => setCompGenderFilter("")} className="hover:text-red-500 transition-colors">×</button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Shift Types Table ── */}
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
              shiftTypes={filteredShiftTypes}
              columnHeaders={columnHeaders}
              onUpdate={updateShiftType}
              onDelete={deleteShiftType}
              dayTypes={dayTypes}
              compositionConfigs={compositionData?.shift_configs}
              onSaveComposition={saveComposition}
            />
          )}

          {/* ── Manual Add ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">הוסף סוג משמרת ידנית</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">שם משמרת</label>
                <input
                  dir="rtl" type="text"
                  placeholder="לדוגמה: 15, 15א׳, 19 (מופרדים בפסיק)"
                  value={newNames}
                  onChange={(e) => setNewNames(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                />
              </div>
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
                        <label key={attr} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-xs font-semibold select-none ${checked ? `${attrToBadgeColor(attr)} border-current shadow-sm` : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleAttr(attr)} className="sr-only" />
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-current border-current" : "border-slate-300 bg-white"}`}>
                            {checked && <svg viewBox="0 0 10 10" fill="white" className="w-2.5 h-2.5"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>}
                          </span>
                          {header}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
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
                        value: dt.id, label: dt.name,
                        color: "bg-white text-slate-500 border-slate-200 hover:bg-slate-50",
                        active: dt.color.replace("100", "600").replace(/text-[a-z]+-800/, "text-white").replace(/border-[a-z]+-200/, `border-${dt.color.split("-")[1]}-600`)
                      }));
                      return [...staticOpts, ...dynamicOpts].map((opt) => (
                        <button key={opt.value} type="button" onClick={() => toggleScheduleOn(opt.value)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${newScheduleOn.includes(opt.value) ? opt.active + " shadow-sm border-current" : opt.color + " border-transparent hover:bg-slate-100"}`}>
                          {opt.label}
                        </button>
                      ));
                    })()}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">
                    ניקוד רצוי
                    <span className="mr-2 font-normal text-slate-400">({DESIRABILITY_LABELS[newDesirability]} · {DESIRABILITY_POINTS[newDesirability]} נק׳ צדק)</span>
                  </label>
                  <DesirabilityStars value={newDesirability} onChange={setNewDesirability} />
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer mt-6 select-none">
                    <input type="checkbox" checked={newIsSpecial} onChange={e => setNewIsSpecial(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-xs font-semibold text-slate-600">משמרת מיוחדת (ניהול מכסה חודשית)</span>
                  </label>
                </div>
              </div>
              {/* ── Composition fields ── */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <p className="text-xs font-semibold text-slate-500">הרכב המשמרת</p>
                <div className="flex items-center gap-6 flex-wrap">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">שעות</label>
                    <input
                      dir="ltr" type="text" placeholder="07:00-15:00"
                      value={newHours} onChange={e => setNewHours(e.target.value)}
                      className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">סה״כ עובדים</label>
                    <Stepper value={newTotalWorkers} onChange={setNewTotalWorkers} min={1} max={20} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">גברים לפחות</label>
                    <Stepper value={newMinMale} onChange={setNewMinMale} min={0} max={newTotalWorkers} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">נשים לפחות</label>
                    <Stepper value={newMinFemale} onChange={setNewMinFemale} min={0} max={newTotalWorkers} />
                  </div>
                </div>

                {/* Role slots */}
                {columnHeaders.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">תפקידים נדרשים</label>
                    <div className="space-y-2">
                      {newRoleSlots.map((role, idx) => (
                        <div key={idx} className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">{role.attribute_name}</span>
                          <span className="text-xs text-slate-400">×</span>
                          <Stepper value={role.count} onChange={v => updateRoleSlot(idx, { count: v })} min={1} max={10} />
                          <button type="button" onClick={() => removeRoleSlot(idx)}
                            className="text-slate-300 hover:text-red-500 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const usedRoles = new Set(newRoleSlots.map(r => r.attribute_name));
                      const available = columnHeaders.filter(h => !usedRoles.has(h));
                      return available.length > 0 ? (
                        <select value="" onChange={e => { if (e.target.value) addRoleSlot(e.target.value); }}
                          className="mt-2 text-xs text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer">
                          <option value="">+ הוסף תפקיד</option>
                          {available.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>

              {addError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{addError}</div>}
              <button type="button" onClick={handleAdd} disabled={addLoading}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm">
                {addLoading ? "מוסיף..." : "+ הוסף משמרת"}
              </button>
            </div>
          </div>

          {/* ── Day Types & Calendar ── */}
          <div className="flex items-center gap-3 flex-wrap bg-slate-50/60 rounded-xl px-4 py-2.5 border border-slate-100">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-400 shrink-0">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd"/>
            </svg>
            <input
              type="text"
              value={dtSearch}
              onChange={e => setDtSearch(e.target.value)}
              placeholder="סנן מבנה יום לפי שם..."
              className="border border-slate-200 rounded-xl px-3 py-1 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">ציון מינימום</span>
              <input
                type="number" min={0} value={dtMinScore}
                onChange={e => setDtMinScore(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                className="w-16 border border-slate-200 rounded-xl px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
              />
            </div>
            {(dtSearch || dtMinScore !== "") && (
              <button type="button" onClick={() => { setDtSearch(""); setDtMinScore(""); }}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors">נקה</button>
            )}
            <span className="text-xs text-slate-400 mr-auto">{filteredDayTypes.length}/{dayTypes.length} סוגים</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DayTypeManager
              dayTypes={filteredDayTypes}
              loading={dayTypesLoading}
              createDayType={createDayTypeAction}
              deleteDayType={deleteDayTypeAction}
              updateDayType={updateDayTypeAction}
            />
            <CalendarConfigurator dayTypes={filteredDayTypes} allDayTypes={dayTypes} />
          </div>

          {/* Weekday Scoring */}
          <WeekdayScoreManager />

        </>
      )}

      {/* ══ Tab: ספציפיקציות ══ */}
      {activeTab === "specifics" && (
        <div className="space-y-6">
          <SpecialShiftMonthlyConfig shiftTypes={shiftTypes} />
          <ShiftInstanceOverrides
            shiftConfigs={compositionData?.shift_configs ?? []}
            shiftTypes={shiftTypes}
            columnHeaders={columnHeaders}
          />
        </div>
      )}

    </div>
  );
}
