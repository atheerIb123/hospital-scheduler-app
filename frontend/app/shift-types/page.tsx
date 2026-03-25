"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Alert, Button, Input, FilterPill, Select, TabButton, TabsContainer, SearchDropdown } from "@/components/ui";
import { X, RotateCcw, Plus, ChevronDown } from "lucide-react";
import ShiftTypeTable, { DesirabilityStars, DESIRABILITY_LABELS, DESIRABILITY_POINTS } from "@/components/ShiftTypeTable";
import type { ScheduleOn, RoleSlot } from "@/lib/types";
import { useShiftTypes } from "@/hooks/useShiftTypes";
import { useDayTypes } from "@/hooks/useDayTypes";
import DayTypeManager from "@/components/DayTypeManager";
import CalendarConfigurator from "@/components/CalendarConfigurator";
import WeekdayScoreManager from "@/components/WeekdayScoreManager";
import { ShiftCard, Stepper } from "@/components/ShiftCompositionConfig";
import SpecialShiftMonthlyConfig from "@/components/SpecialShiftMonthlyConfig";
import ShiftInstanceOverrides from "@/components/ShiftInstanceOverrides";
import { useShiftComposition } from "@/hooks/useShiftComposition";
import { useMode } from "@/components/ModeProvider";

type TabId = "shift-types" | "day-structure" | "specifics";

// ── Multi-select dropdown ─────────────────────────────────────────────────────
function MultiSelectDropdown({
  options,
  selectedValues,
  onToggle,
  placeholder,
  showAllLabel = "כל הימים",
}: {
  options: { value: string; label: string }[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  placeholder: string;
  showAllLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return;
    const btn = btnRef.current;
    if (btn) {
      const r = btn.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 200) });
    }
    const onDown = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const allSelected = selectedValues.includes("all");
  const showPills = selectedValues.length > 0 && !allSelected;
  const displayText = selectedValues.length === 0 ? placeholder
    : allSelected ? showAllLabel
    : `${selectedValues.length} נבחרו`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-40 justify-between"
        dir="rtl"
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {showPills && selectedValues.map(val => {
        const opt = options.find(o => o.value === val);
        if (!opt) return null;
        return (
          <span key={val} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            {opt.label}
            <button type="button" onClick={() => onToggle(val)} className="hover:text-blue-900 transition-colors ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        );
      })}

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ top: panelPos.top, left: panelPos.left, minWidth: panelPos.width }}
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-52 overflow-auto"
          dir="rtl"
        >
          {options.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selectedValues.includes(opt.value)}
                onChange={() => onToggle(opt.value)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function ShiftTypesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("shift-types");
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

  const { data: compositionData, seedNursing, save: saveComposition } = useShiftComposition();
  const [seedingNursing, setSeedingNursing] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const handleSeedNursing = async () => {
    if (!window.confirm("פעולה זו תאפס את כל סוגי המשמרות לברירות המחדל של סיעוד. להמשיך?")) return;
    setSeedingNursing(true);
    try { await seedNursing(); await reload(); }
    catch { /* ignore */ }
    finally { setSeedingNursing(false); }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("למחוק את כל סוגי המשמרות? פעולה זו אינה הפיכה.")) return;
    setDeletingAll(true);
    try { await deleteAllShiftTypes(); }
    catch { /* ignore */ }
    finally { setDeletingAll(false); }
  };

  // ── Shift type filter state ───────────────────────────────────────────────
  const [shiftSearch, setShiftSearch] = useState("");
  const [shiftDesFilter, setShiftDesFilter] = useState<number>(0);
  const [shiftAttrFilter, setShiftAttrFilter] = useState<string>("");
  const [shiftDayFilter, setShiftDayFilter] = useState<string>("");
  const [shiftSpecialFilter, setShiftSpecialFilter] = useState(false);
  const [compRoleFilter, setCompRoleFilter] = useState<Set<string>>(new Set());
  const [compRoleMode, setCompRoleMode] = useState<"or" | "and">("or");
  const [compMinWorkers, setCompMinWorkers] = useState<number | "">("");
  const [compMaxWorkers, setCompMaxWorkers] = useState<number | "">("");
  const [compGenderFilter, setCompGenderFilter] = useState<"" | "male" | "female">("");
  const [showAddForm, setShowAddForm] = useState(false);

  const toggleRoleFilter = (r: string) => setCompRoleFilter(prev => { const s = new Set(prev); s.has(r) ? s.delete(r) : s.add(r); return s; });

  const clearAllFilters = () => {
    setShiftSearch("");
    setShiftDesFilter(0);
    setShiftAttrFilter("");
    setShiftDayFilter("");
    setShiftSpecialFilter(false);
    setCompRoleFilter(new Set());
    setCompMinWorkers("");
    setCompMaxWorkers("");
    setCompGenderFilter("");
  };

  const activeFilterCount =
    (shiftSearch ? 1 : 0) +
    (shiftDesFilter > 0 ? 1 : 0) +
    (shiftAttrFilter ? 1 : 0) +
    (shiftDayFilter ? 1 : 0) +
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
      if (shiftDesFilter > 0 && Number(st.desirability ?? 3) !== shiftDesFilter) return false;
      if (shiftAttrFilter && !st.required_attributes.includes(shiftAttrFilter)) return false;
      if (shiftDayFilter) {
        const days: string[] = Array.isArray(st.schedule_on) ? st.schedule_on : [st.schedule_on ?? "all"];
        if (!days.includes("all") && !days.includes(shiftDayFilter)) return false;
      }

      // Composition filters
      const hasCompFilter = compRoleFilter.size > 0 || compMinWorkers !== "" || compMaxWorkers !== "" || compGenderFilter;
      if (hasCompFilter) {
        const cfg = configs.find(c => st.names.includes(c.shift_name));
        if (!cfg) return false;
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

  // Composition fields for new shift (nursing only)
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
      if (next.has(attr)) { next.delete(attr); } else { next.add(attr); }
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
      if (allSpecific.every(opt => result.includes(opt))) return ["all"];
      return result;
    });
  };

  const resetAddForm = () => {
    setNewNames("");
    setSelectedAttrs(new Set());
    setNewScheduleOn(["all"]);
    setNewDesirability(3);
    setNewIsSpecial(false);
    setAddError(null);
    setNewHours("");
    setNewTotalWorkers(4);
    setNewRoleSlots([]);
    setNewMinMale(0);
    setNewMinFemale(0);
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
        await saveComposition([...currentConfigs, {
          shift_name: primaryName,
          hours: newHours,
          total_workers: newTotalWorkers,
          role_slots: newRoleSlots,
          min_male: newMinMale,
          min_female: newMinFemale,
        }]);
      }

      resetAddForm();
      setShowAddForm(false);
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">סוגי משמרות</h1>
        <p className="text-slate-500 mt-1 text-sm">
          הגדר סוגי משמרות, תכונות נדרשות, ניקוד רצוי ומבנה ימים מיוחדים.
        </p>
      </div>

      {/* ── Tabs ── */}
      <TabsContainer>
        <TabButton active={activeTab === "shift-types"} onClick={() => setActiveTab("shift-types")} className="px-4 py-2">
          סוגי משמרות
        </TabButton>
        <TabButton active={activeTab === "day-structure"} onClick={() => setActiveTab("day-structure")} className="px-4 py-2">
          מבנה ימים
        </TabButton>
        {isNursing && (
          <TabButton active={activeTab === "specifics"} onClick={() => setActiveTab("specifics")} className="px-4 py-2">
            ספציפיקציות
          </TabButton>
        )}
      </TabsContainer>

      {/* ── Tab: Shift Types ── */}
      {activeTab === "shift-types" && (
        <div className="space-y-6">

          {/* Manual Add form — modal popup */}
          {showAddForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <h2 className="font-semibold text-slate-800">משמרת חדשה</h2>
                  <button
                    type="button"
                    onClick={() => { resetAddForm(); setShowAddForm(false); }}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-5 overflow-auto">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">שם משמרת</label>
                    <Input
                      dir="rtl"
                      type="text"
                      placeholder="לדוגמה: 15, 15א׳, 19 (מופרדים בפסיק)"
                      value={newNames}
                      onChange={(e) => setNewNames(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">תכונות נדרשות</label>
                    {columnHeaders.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                        ייבא קובץ עובדים תחילה כדי לראות את שמות התכונות
                      </p>
                    ) : (
                      <MultiSelectDropdown
                        options={columnHeaders.map((header, i) => ({ value: `col_${i + 1}`, label: header }))}
                        selectedValues={Array.from(selectedAttrs)}
                        onToggle={toggleAttr}
                        placeholder="בחר תכונות..."
                      />
                    )}
                  </div>

                  <div className="flex items-start gap-8 flex-wrap">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2">ימי תזמון</label>
                      <MultiSelectDropdown
                        options={[
                          { value: "all", label: "כל הימים" },
                          { value: "weekdays", label: "ימי חול" },
                          { value: "friday", label: "שישי" },
                          { value: "weekend", label: "סוף שבוע" },
                          ...dayTypes.map(dt => ({ value: dt.id, label: dt.name })),
                        ]}
                        selectedValues={newScheduleOn}
                        onToggle={toggleScheduleOn}
                        placeholder="בחר ימים..."
                      />
                    </div>
                    {isNursing && (
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer mt-6 select-none">
                          <input type="checkbox" checked={newIsSpecial} onChange={e => setNewIsSpecial(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          <span className="text-xs font-semibold text-slate-600">משמרת מיוחדת (ניהול מכסה חודשית)</span>
                        </label>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">
                      ניקוד רצוי
                      <span className="mr-2 font-normal text-slate-400">
                        ({DESIRABILITY_LABELS[newDesirability]} · {DESIRABILITY_POINTS[newDesirability]} נק׳ צדק)
                      </span>
                    </label>
                    <DesirabilityStars value={newDesirability} onChange={setNewDesirability} />
                  </div>

                  {/* Composition fields — nursing only */}
                  {isNursing && (
                    <div className="border-t border-slate-100 pt-4 space-y-4">
                      <p className="text-xs font-semibold text-slate-500">הרכב המשמרת</p>
                      <div className="flex items-center gap-6 flex-wrap">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5">שעות</label>
                          <input dir="ltr" type="text" placeholder="07:00-15:00"
                            value={newHours} onChange={e => setNewHours(e.target.value)}
                            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-100" />
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

                      {columnHeaders.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-2">תפקידים נדרשים</label>
                          <div className="space-y-2">
                            {newRoleSlots.map((role, idx) => (
                              <div key={idx} className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">{role.attribute_name}</span>
                                <span className="text-xs text-slate-400">×</span>
                                <Stepper value={role.count} onChange={v => updateRoleSlot(idx, { count: v })} min={1} max={10} />
                                <button type="button" onClick={() => removeRoleSlot(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                                  <X className="w-3.5 h-3.5" />
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
                  )}

                  {addError && <Alert type="error">{addError}</Alert>}
                  <div className="flex gap-3">
                    <Button type="button" onClick={handleAdd} disabled={addLoading}>
                      {addLoading ? "מוסיף..." : "הוסף משמרת"}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => { resetAddForm(); setShowAddForm(false); }} disabled={addLoading}>
                      ביטול
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Filters + Actions row ── */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Left: filters */}
            <SearchDropdown
              value={shiftSearch}
              onChange={setShiftSearch}
              options={shiftTypes.flatMap(st => st.names)}
              placeholder="חיפוש לפי שם משמרת..."
              className="w-48"
            />
            <Select value={shiftDesFilter} onChange={e => setShiftDesFilter(Number(e.target.value))} optionPrefix="הצג לפי">
              <option value={0}>כל ניקוד</option>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{"★".repeat(n)}</option>)}
            </Select>
            {columnHeaders.length > 0 && (
              <Select value={shiftAttrFilter} onChange={e => setShiftAttrFilter(e.target.value)} optionPrefix="הצג לפי">
                <option value="">כל התכונות</option>
                {columnHeaders.map((h, i) => <option key={`col_${i + 1}`} value={`col_${i + 1}`}>{h}</option>)}
              </Select>
            )}
            <Select value={shiftDayFilter} onChange={e => setShiftDayFilter(e.target.value)}>
              <option value="">כל הימים</option>
              <option value="weekdays">ימי חול</option>
              <option value="friday">שישי</option>
              <option value="weekend">סוף שבוע</option>
              {dayTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
            </Select>
            {isNursing && (
              <FilterPill
                active={shiftSpecialFilter}
                activeClassName="bg-purple-100 text-purple-700 border-purple-200"
                onClick={() => setShiftSpecialFilter(p => !p)}
              >
                מיוחדת בלבד
              </FilterPill>
            )}
            {activeFilterCount > 0 && (
              <Button type="button" variant="secondary" onClick={clearAllFilters}>נקה הכל</Button>
            )}
            <span className="text-xs text-slate-400">{filteredShiftTypes.length}/{shiftTypes.length} משמרות</span>

            {/* Right: actions */}
            <div className="flex items-center gap-2 mr-auto">
              {defaultsSuccess && <p className="text-xs text-green-600 font-medium">{defaultsSuccess}</p>}
              {defaultsError && <p className="text-xs text-red-600 font-medium">{defaultsError}</p>}
              {isNursing && (
                <Button type="button" variant="secondary" onClick={handleSeedNursing} disabled={seedingNursing}>
                  {seedingNursing ? "טוען..." : "טען ברירת מחדל סיעוד"}
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={handleLoadDefaults} disabled={defaultsLoading} icon={<RotateCcw className="w-4 h-4" />}>
                {defaultsLoading ? "טוען..." : "טען ברירת מחדל"}
              </Button>
              {isNursing && (
                <Button type="button" variant="danger" onClick={handleDeleteAll} disabled={deletingAll || shiftTypes.length === 0}>
                  {deletingAll ? "מוחק..." : "מחק הכל"}
                </Button>
              )}
              <Button type="button" onClick={() => setShowAddForm(true)} disabled={showAddForm} icon={<Plus className="w-4 h-4" />}>
                הוסף סוג משמרת
              </Button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 rounded-xl shimmer" />)}
            </div>
          ) : error ? (
            <Alert type="error">{error}</Alert>
          ) : (
            <ShiftTypeTable
              shiftTypes={filteredShiftTypes}
              columnHeaders={columnHeaders}
              onUpdate={updateShiftType}
              onDelete={deleteShiftType}
              dayTypes={dayTypes}
              compositionConfigs={isNursing ? compositionData?.shift_configs : undefined}
              onSaveComposition={isNursing ? saveComposition : undefined}
            />
          )}
        </div>
      )}

      {/* ── Tab: Day Structure ── */}
      {activeTab === "day-structure" && (
        <div className="space-y-6">
          {/* Filter + action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <SearchDropdown
              value={dtSearch}
              onChange={setDtSearch}
              options={dayTypes.map(dt => dt.name)}
              placeholder="סנן מבנה יום לפי שם..."
              className="w-44"
            />
            <Input
              type="number"
              inputPrefix="ציון מינימום: "
              placeholder="אין"
              min={0}
              value={dtMinScore}
              onChange={e => setDtMinScore(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
            />
            {(dtSearch || dtMinScore !== "") && (
              <Button type="button" variant="secondary" onClick={() => { setDtSearch(""); setDtMinScore(""); }}>
                נקה
              </Button>
            )}
            <span className="text-xs text-slate-400">{filteredDayTypes.length}/{dayTypes.length} סוגים</span>

            <div className="flex items-center gap-2 mr-auto">
              <WeekdayScoreManager />
              <DayTypeManager
                dayTypes={filteredDayTypes}
                loading={dayTypesLoading}
                createDayType={createDayTypeAction}
                deleteDayType={deleteDayTypeAction}
                updateDayType={updateDayTypeAction}
              />
            </div>
          </div>

          <CalendarConfigurator dayTypes={filteredDayTypes} allDayTypes={dayTypes} />
        </div>
      )}

      {/* ── Tab: Specifics (nursing only) ── */}
      {activeTab === "specifics" && isNursing && (
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
