"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { ChevronDown, ChevronUp, Settings, RotateCcw, X, Check, UserPlus, RefreshCw, Download, Upload, Wand2 } from "lucide-react";
import type { OncallConfig, OncallDay, OncallSlot, OncallAssignment } from "@/lib/types";
import type { Employee } from "@/lib/types";
import * as api from "@/lib/api";
import { downloadNursingOncallXlsx } from "@/lib/exportNursingOncallExcel";
import { Button, Alert, Badge, Select } from "@/components/ui";
import { BADGE_COLORS } from "@/lib/colors";

const MONTH_NAMES = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

// Default rotation orders per slot, taken from the printed table in the image
const DEFAULT_ROTATION: Record<OncallSlot, string[]> = {
  "ערב_1": ["שיטה", "ארז", "אגוז", "ברוש", "שקד", "דקל", "אדר", "דובדבן", "הדס", "גפן", "דולב", "תאנה", "אלון"],
  "ערב_2": ["דקל", "דובדבן", "גפן", "דולב", "הדס", "תאנה", "ברוש", "שקד", "אדר", "שיטה", "ארז", "אלון", "אגוז"],
  "לילה":  ["שקד", "ברוש", "הדס", "שיטה", "תאנה", "גפן", "דקל", "דובדבן", "ארז", "אלון", "אגוז", "אדר", "דולב"],
};
const SLOT_LABELS: Record<OncallSlot, string> = {
  "ערב_1": "כוננות ערב I",
  "ערב_2": "כוננות ערב II",
  "לילה": "כוננות לילה",
};
const SLOTS: OncallSlot[] = ["ערב_1", "ערב_2", "לילה"];

const HE_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function dayOfWeekLabel(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return HE_DAYS[d.getDay()];
}

// ── Config panel ─────────────────────────────────────────────────────────────

function ConfigPanel({
  config,
  departments,
  columnHeaders,
  onSave,
}: {
  config: OncallConfig;
  departments: string[];
  columnHeaders: string[];
  onSave: (c: OncallConfig) => void;
}) {
  const [local, setLocal] = useState<OncallConfig>(JSON.parse(JSON.stringify(config)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(JSON.parse(JSON.stringify(config)));
  }, [config]);

  const addDept = (slot: OncallSlot, dept: string) => {
    if (!dept || local.slots[slot].includes(dept)) return;
    setLocal(c => ({ ...c, slots: { ...c.slots, [slot]: [...c.slots[slot], dept] } }));
  };

  const removeDept = (slot: OncallSlot, idx: number) => {
    setLocal(c => ({
      ...c,
      slots: { ...c.slots, [slot]: c.slots[slot].filter((_, i) => i !== idx) },
    }));
  };

  const moveDept = (slot: OncallSlot, idx: number, dir: -1 | 1) => {
    const arr = [...local.slots[slot]];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setLocal(c => ({ ...c, slots: { ...c.slots, [slot]: arr } }));
  };

  const loadDefaults = () => {
    setLocal(c => ({ ...c, slots: { ...DEFAULT_ROTATION } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(local); } finally { setSaving(false); }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-5" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Settings size={16} className="text-blue-600" />
          הגדרת סדר רוטציה
        </h3>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={loadDefaults} icon={<RotateCcw size={13} />}>
            ברירת מחדל
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
            {saving ? "שומר..." : "שמור הגדרות"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1 max-w-xs">
        <label className="text-xs text-slate-500">תאריך התחלה של הרוטציה</label>
        <input
          type="date"
          value={local.start_date ?? ""}
          onChange={e => setLocal(c => ({ ...c, start_date: e.target.value || null }))}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          dir="ltr"
        />
        <p className="text-xs text-slate-400">היום הראשון שבו מחלקה 1 ברשימה תהיה אחראית</p>
      </div>

      {/* Required attributes for oncall eligibility */}
      {columnHeaders.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-500 font-medium">תכונות נדרשות לכוננות</label>
          <p className="text-xs text-slate-400">עובד יוצג כ"מתאים" רק אם יש לו את כל התכונות האלה. ריק = כולם מתאימים.</p>
          <div className="flex flex-wrap gap-1.5">
            {(local.required_attributes ?? []).map(col => {
              const idx = parseInt(col.replace("col_", "")) - 1;
              const name = columnHeaders[idx] ?? col;
              return (
                <span key={col} className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {name}
                  <button onClick={() => setLocal(c => ({ ...c, required_attributes: (c.required_attributes ?? []).filter(a => a !== col) }))} className="hover:text-blue-900">
                    <X size={11} />
                  </button>
                </span>
              );
            })}
          </div>
          {columnHeaders.filter((_, i) => !(local.required_attributes ?? []).includes(`col_${i + 1}`)).length > 0 && (
            <select
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 max-w-xs"
              value=""
              onChange={e => {
                if (!e.target.value) return;
                setLocal(c => ({ ...c, required_attributes: [...(c.required_attributes ?? []), e.target.value] }));
                e.target.value = "";
              }}
            >
              <option value="">+ הוסף תכונה נדרשת</option>
              {columnHeaders.map((h, i) => {
                const col = `col_${i + 1}`;
                if ((local.required_attributes ?? []).includes(col)) return null;
                return <option key={col} value={col}>{h}</option>;
              })}
            </select>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SLOTS.map(slot => {
          const unusedDepts = departments.filter(d => !local.slots[slot].includes(d));
          return (
            <div key={slot} className="flex flex-col gap-2">
              <p className="text-sm font-medium text-slate-700">{SLOT_LABELS[slot]}</p>
              <div className="flex flex-col gap-1 min-h-[60px] bg-slate-50 rounded-xl p-2 border border-slate-100">
                {local.slots[slot].map((dept, i) => (
                  <div key={dept} className="flex items-center justify-between bg-white rounded-lg px-2 py-1 border border-slate-200 text-sm">
                    <span className="text-slate-800">{dept}</span>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => moveDept(slot, i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30 p-0.5">
                        <ChevronUp size={13} />
                      </button>
                      <button onClick={() => moveDept(slot, i, 1)} disabled={i === local.slots[slot].length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30 p-0.5">
                        <ChevronDown size={13} />
                      </button>
                      <button onClick={() => removeDept(slot, i)} className="text-rose-400 hover:text-rose-600 p-0.5 mr-0.5">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                {local.slots[slot].length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-1">אין מחלקות</p>
                )}
              </div>
              {unusedDepts.length > 0 && (
                <select
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value=""
                  onChange={e => { addDept(slot, e.target.value); e.target.value = ""; }}
                >
                  <option value="">+ הוסף מחלקה</option>
                  {unusedDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Assignment picker modal ───────────────────────────────────────────────────

function AssignmentModal({
  date,
  slot,
  department,
  employees,
  requiredAttributes,
  columnHeaders,
  current,
  onSave,
  onDelete,
  onClose,
}: {
  date: string;
  slot: OncallSlot;
  department: string;
  employees: Employee[];
  requiredAttributes: string[];
  columnHeaders: string[];
  current: OncallAssignment | null;
  onSave: (empId: string, empName: string, dept: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(current?.employee_id ?? "");
  const [search, setSearch] = useState("");
  const [deptOpen, setDeptOpen] = useState(true);
  const [deptUnfitOpen, setDeptUnfitOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherUnfitOpen, setOtherUnfitOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isFit = (e: Employee) =>
    !requiredAttributes.length || requiredAttributes.every(attr => (e.attributes ?? []).includes(attr));

  const getMissingAttrs = (e: Employee): string[] =>
    requiredAttributes
      .filter(attr => !(e.attributes ?? []).includes(attr))
      .map(attr => {
        const idx = parseInt(attr.replace("col_", "")) - 1;
        return columnHeaders[idx] ?? attr;
      });

  const active = employees.filter(e => e.active !== false);
  const deptEmps = active.filter(e => e.home_department === department);
  const otherEmps = active.filter(e => e.home_department !== department);

  const q = search.trim().toLowerCase();
  const filtered = (list: Employee[]) =>
    q ? list.filter(e => e.name.toLowerCase().includes(q) || (e.home_department ?? "").toLowerCase().includes(q)) : list;

  const filteredDept = filtered(deptEmps);
  const filteredOther = filtered(otherEmps);
  const searchingAll = q.length > 0;
  const allForSearch = filtered(active);

  const d = new Date(date + "T12:00:00");
  const dateLabel = `${dayOfWeekLabel(date)} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

  const selectedEmp = active.find(e => e.id === selectedId);

  const handleSave = async () => {
    if (!selectedEmp) return;
    setSaving(true);
    try { onSave(selectedEmp.id, selectedEmp.name, selectedEmp.home_department ?? ""); } finally { setSaving(false); }
  };

  function EmpRow({ emp, showMissing }: { emp: Employee; showMissing?: boolean }) {
    const chosen = emp.id === selectedId;
    const missing = showMissing ? getMissingAttrs(emp) : [];
    return (
      <button
        key={emp.id}
        onClick={() => setSelectedId(emp.id)}
        className={`w-full flex items-start justify-between px-3 py-2 rounded-lg text-sm transition-colors ${chosen ? "bg-blue-50 border border-blue-200 text-blue-800" : "hover:bg-slate-50 text-slate-700"}`}
      >
        <div className="flex flex-col items-start gap-0.5 min-w-0">
          <span className="font-medium">{emp.name}</span>
          {missing.length > 0 && (
            <span className="text-[10px] text-rose-500 leading-tight">חסר: {missing.join(", ")}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {emp.home_department && (
            <span className="text-xs text-slate-400">{emp.home_department}</span>
          )}
          {chosen && <Check size={14} className="text-blue-600" />}
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl flex flex-col max-h-[90vh]" dir="rtl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="font-semibold text-slate-800 text-sm">{SLOT_LABELS[slot]}</p>
            <p className="text-xs text-slate-500 mt-0.5">{dateLabel}{department ? ` · אחראי: ${department}` : ""}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="relative">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש עובד..."
              className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-slate-50"
              dir="rtl"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </span>
          </div>
        </div>

        {/* Employee list */}
        <div className="overflow-y-auto flex-1 px-4 pb-3 flex flex-col gap-1">
          {searchingAll ? (
            allForSearch.length === 0
              ? <p className="text-xs text-slate-400 text-center py-4">לא נמצאו עובדים</p>
              : allForSearch.map(e => <EmpRow key={e.id} emp={e} />)
          ) : (
            <>
              {/* Responsible department — fits */}
              {department && (
                <button
                  onClick={() => setDeptOpen(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold mt-1 mb-0.5 hover:text-slate-900 transition-colors"
                >
                  {deptOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  מחלקה אחראית — {department}
                  {requiredAttributes.length > 0 && <span className="text-emerald-600 font-medium"> · מתאימים ({filteredDept.filter(isFit).length})</span>}
                  {requiredAttributes.length === 0 && <span> ({filteredDept.length})</span>}
                </button>
              )}
              {deptOpen && filteredDept.filter(isFit).length === 0 && department && (
                <p className="text-xs text-slate-400 px-1">אין כוננים מתאימים במחלקה זו</p>
              )}
              {deptOpen && filteredDept.filter(isFit).map(e => <EmpRow key={e.id} emp={e} />)}

              {/* Responsible department — unfits (independent collapsible) */}
              {requiredAttributes.length > 0 && filteredDept.filter(e => !isFit(e)).length > 0 && (
                <>
                  <button
                    onClick={() => setDeptUnfitOpen(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-rose-400 font-medium mt-2 mb-0.5 hover:text-rose-600 transition-colors"
                  >
                    {deptUnfitOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {department} — לא מתאימים ({filteredDept.filter(e => !isFit(e)).length})
                  </button>
                  {deptUnfitOpen && filteredDept.filter(e => !isFit(e)).map(e => <EmpRow key={e.id} emp={e} showMissing />)}
                </>
              )}

              {/* Other departments (collapsible) — fits */}
              {otherEmps.length > 0 && (
                <button
                  onClick={() => setOtherOpen(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-2 mb-0.5 hover:text-slate-700 transition-colors"
                >
                  {otherOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  מחלקות אחרות
                  {requiredAttributes.length > 0 && <span className="text-emerald-600"> · מתאימים ({filteredOther.filter(isFit).length})</span>}
                  {requiredAttributes.length === 0 && <span> ({filteredOther.length})</span>}
                </button>
              )}
              {otherOpen && filteredOther.filter(isFit).map(e => <EmpRow key={e.id} emp={e} />)}

              {/* Other departments — unfits (independent collapsible) */}
              {requiredAttributes.length > 0 && filteredOther.filter(e => !isFit(e)).length > 0 && (
                <>
                  <button
                    onClick={() => setOtherUnfitOpen(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-rose-400 font-medium mt-2 mb-0.5 hover:text-rose-600 transition-colors"
                  >
                    {otherUnfitOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    מחלקות אחרות — לא מתאימים ({filteredOther.filter(e => !isFit(e)).length})
                  </button>
                  {otherUnfitOpen && filteredOther.filter(e => !isFit(e)).map(e => <EmpRow key={e.id} emp={e} showMissing />)}
                </>
              )}
            </>
          )}
        </div>

        {/* Selected preview */}
        {selectedEmp && (
          <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 shrink-0">
            <p className="text-xs text-blue-700">
              נבחר: <span className="font-semibold">{selectedEmp.name}</span>
              {selectedEmp.home_department && <span className="text-blue-500"> · {selectedEmp.home_department}</span>}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex justify-between gap-2 shrink-0">
          {current && (
            <Button variant="danger" size="sm" onClick={onDelete}>הסר</Button>
          )}
          <div className="flex gap-2 mr-auto">
            <Button variant="secondary" size="sm" onClick={onClose}>ביטול</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!selectedId || saving}>
              {saving ? "שומר..." : "שמור"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Override modal ────────────────────────────────────────────────────────────

function OverrideModal({
  date,
  slot,
  current,
  departments,
  onSave,
  onDelete,
  onClose,
}: {
  date: string;
  slot: OncallSlot;
  current: string;
  departments: string[];
  onSave: (dept: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [dept, setDept] = useState(current);
  const d = new Date(date + "T12:00:00");
  const dateLabel = `${dayOfWeekLabel(date)} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xs shadow-xl" dir="rtl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="font-semibold text-slate-800 text-sm">שינוי מחלקה אחראית</p>
            <p className="text-xs text-slate-500 mt-0.5">{SLOT_LABELS[slot]} · {dateLabel}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <select
            value={dept}
            onChange={e => setDept(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          >
            <option value="">— בחר מחלקה —</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onDelete} icon={<RotateCcw size={13} />}>בטל שינוי</Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>ביטול</Button>
            <Button variant="primary" size="sm" onClick={() => dept && onSave(dept)} disabled={!dept}>אשר</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseOncallFile(
  file: File,
  year: number,
  employees: Employee[],
): Promise<{
  overrides: { date: string; slot: string; department: string }[];
  assignments: { date: string; slot: string; employee_id: string; employee_name: string; from_department: string }[];
  unmatched: string[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (data.length < 2) { reject(new Error("קובץ ריק")); return; }

        const headerRow = data[0] as (string | number)[];
        // build colIdx → ISO date string
        const colToDate: Record<number, string> = {};
        headerRow.forEach((cell, ci) => {
          if (ci < 2) return;
          const str = String(cell).trim();
          const m = str.match(/^(\d{1,2})\/(\d{1,2})$/);
          if (m) {
            colToDate[ci] = `${year}-${String(parseInt(m[2])).padStart(2, "0")}-${String(parseInt(m[1])).padStart(2, "0")}`;
          }
        });

        const LABEL_TO_SLOT: Record<string, string> = {
          "כוננות ערב I": "ערב_1",
          "כוננות ערב II": "ערב_2",
          "כוננות לילה": "לילה",
        };

        const overrides: { date: string; slot: string; department: string }[] = [];
        const assignments: { date: string; slot: string; employee_id: string; employee_name: string; from_department: string }[] = [];
        const unmatched: string[] = [];
        let currentSlot = "";

        for (let ri = 2; ri < data.length; ri++) {
          const row = data[ri] as (string | number)[];
          const colA = String(row[0] ?? "").trim();
          const colB = String(row[1] ?? "").trim();
          if (colA && LABEL_TO_SLOT[colA]) currentSlot = LABEL_TO_SLOT[colA];
          if (!currentSlot) continue;

          for (const [ciStr, date] of Object.entries(colToDate)) {
            const ci = parseInt(ciStr);
            const val = String(row[ci] ?? "").trim();
            if (!val) continue;
            if (colB === "מחלקה") {
              overrides.push({ date, slot: currentSlot, department: val });
            } else if (colB === "הפעלה") {
              const emp = employees.find(e => e.name === val);
              if (emp) {
                assignments.push({ date, slot: currentSlot, employee_id: emp.id, employee_name: emp.name, from_department: emp.home_department ?? "" });
              } else {
                if (!unmatched.includes(val)) unmatched.push(val);
              }
            }
          }
        }
        resolve({ overrides, assignments, unmatched });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("שגיאה בקריאת הקובץ"));
    reader.readAsArrayBuffer(file);
  });
}

// ── Rotation table ────────────────────────────────────────────────────────────

function RotationTable({
  days,
  onAssign,
  onOverride,
  highlightEmp,
  filterDept,
}: {
  days: OncallDay[];
  onAssign: (date: string, slot: OncallSlot) => void;
  onOverride: (date: string, slot: OncallSlot) => void;
  highlightEmp: string;
  filterDept: string;
}) {
  if (!days.length) return <p className="text-sm text-slate-400 text-center py-8">אין נתונים</p>;

  const firstHalf = days.slice(0, 16);
  const secondHalf = days.slice(16);

  function renderHalf(chunk: OncallDay[]) {
    return (
      <div className="overflow-x-auto border border-slate-300 rounded-lg">
        <table className="text-xs border-collapse w-full" dir="rtl">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-1.5 font-semibold text-slate-700 text-right min-w-[90px]" colSpan={2}>תאריך</th>
              {chunk.map(day => {
                const d = new Date(day.date + "T12:00:00");
                return (
                  <th key={day.date} className="border border-slate-300 px-1 py-1 text-center font-semibold text-slate-700 min-w-[56px]">
                    <span className="block text-[10px] text-slate-500">{dayOfWeekLabel(day.date)}</span>
                    <span className="block">{d.getDate()}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot, si) => {
              const rowBg = si % 2 === 0 ? "bg-white" : "bg-slate-50/60";
              return (
                <React.Fragment key={slot}>
                  <tr className={rowBg}>
                    <td rowSpan={2} className="border border-slate-300 px-2 py-1 font-semibold text-slate-800 text-right align-middle whitespace-nowrap bg-slate-50 min-w-[90px]">
                      {SLOT_LABELS[slot]}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-slate-500 text-right whitespace-nowrap bg-slate-50/80 w-14">מחלקה</td>
                    {chunk.map(day => {
                      const s = day.slots[slot];
                      const deptMatch = filterDept && s.department === filterDept;
                      const dimCell = filterDept && !deptMatch;
                      return (
                        <td key={day.date} className={`border border-slate-300 px-1 py-1 text-center transition-colors ${deptMatch ? "bg-blue-50" : dimCell ? "opacity-30" : ""}`}>
                          <button
                            onClick={() => onOverride(day.date, slot)}
                            className={`text-xs font-medium w-full leading-tight hover:opacity-75 transition-opacity flex items-center justify-center gap-0.5 ${s.is_override ? "text-amber-700" : "text-slate-800"}`}
                            title={s.is_override ? "שינוי ידני — לחץ לעדכון" : "לחץ לשינוי מחלקה"}
                          >
                            <span>{s.department || "—"}</span>
                            <ChevronDown size={10} className="shrink-0 opacity-50" />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                  <tr className={rowBg}>
                    <td className="border border-slate-300 px-2 py-1 text-slate-500 text-right whitespace-nowrap bg-slate-50/80 w-14">הפעלה</td>
                    {chunk.map(day => {
                      const s = day.slots[slot];
                      const assigned = s.assignment;
                      const empMatch = highlightEmp && assigned?.employee_name.toLowerCase().includes(highlightEmp.toLowerCase());
                      const deptMatch = filterDept && s.department === filterDept;
                      const dimCell = filterDept && !deptMatch;
                      return (
                        <td key={day.date} className={`border border-slate-300 px-1 py-1.5 text-center transition-colors ${empMatch ? "bg-yellow-100 ring-1 ring-yellow-400" : dimCell ? "opacity-30" : ""}`}>
                          {assigned ? (
                            <button onClick={() => onAssign(day.date, slot)} className={`text-xs font-medium hover:text-blue-600 transition-colors w-full leading-tight ${empMatch ? "text-yellow-800 font-bold" : "text-slate-800"}`}>
                              {assigned.employee_name}
                            </button>
                          ) : (
                            <button onClick={() => onAssign(day.date, slot)} className="text-slate-200 hover:text-blue-400 transition-colors" title="שבץ כונן">
                              <UserPlus size={12} className="mx-auto" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {renderHalf(firstHalf)}
      {secondHalf.length > 0 && renderHalf(secondHalf)}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OncallPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [config, setConfig] = useState<OncallConfig | null>(null);
  const [days, setDays] = useState<OncallDay[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showAutoGenModal, setShowAutoGenModal] = useState(false);
  const [autoGenOverwrite, setAutoGenOverwrite] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  // Modal state
  const [assignModal, setAssignModal] = useState<{ date: string; slot: OncallSlot } | null>(null);
  const [overrideModal, setOverrideModal] = useState<{ date: string; slot: OncallSlot } | null>(null);
  const [empSearch, setEmpSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [showImportGuide, setShowImportGuide] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    overrides: { date: string; slot: string; department: string }[];
    assignments: { date: string; slot: string; employee_id: string; employee_name: string; from_department: string }[];
    unmatched: string[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMonthly = useCallback(() => {
    api.getOncallMonthly(year, month).then(setDays).catch(() => setDays([]));
  }, [year, month]);

  useEffect(() => {
    api.getOncallConfig().then(setConfig).catch(() =>
      setConfig({ slots: { "ערב_1": [], "ערב_2": [], "לילה": [] }, start_date: null })
    );
    api.getDepartments().then(setDepartments).catch(() => setDepartments([]));
    api.getEmployees().then(setEmployees).catch(() => setEmployees([]));
    api.getColumnHeaders().then(setColumnHeaders).catch(() => setColumnHeaders([]));
  }, []);

  useEffect(() => { loadMonthly(); }, [loadMonthly]);

  const applyDefaults = async () => {
    if (!config) return;
    const defaultConfig: OncallConfig = { slots: { ...DEFAULT_ROTATION }, start_date: config.start_date };
    try {
      await api.saveOncallConfig(defaultConfig);
      setConfig(defaultConfig);
      loadMonthly();
      setAlert({ type: "success", msg: "ברירת המחדל נטענה ונשמרה" });
    } catch {
      setAlert({ type: "error", msg: "שגיאה בטעינת ברירת המחדל" });
    }
  };

  const saveConfig = async (c: OncallConfig) => {
    try {
      await api.saveOncallConfig(c);
      setConfig(c);
      loadMonthly();
      setAlert({ type: "success", msg: "הגדרות הרוטציה נשמרו" });
    } catch {
      setAlert({ type: "error", msg: "שגיאה בשמירת ההגדרות" });
    }
  };

  const openAssignModal = (date: string, slot: OncallSlot) => setAssignModal({ date, slot });
  const openOverrideModal = (date: string, slot: OncallSlot) => setOverrideModal({ date, slot });

  const handleAssignSave = async (empId: string, empName: string, dept: string) => {
    if (!assignModal) return;
    try {
      await api.setOncallAssignment(assignModal.date, assignModal.slot, empId, empName, dept);
      setAssignModal(null);
      loadMonthly();
      setAlert({ type: "success", msg: "הכונן שובץ בהצלחה" });
    } catch {
      setAlert({ type: "error", msg: "שגיאה בשיבוץ הכונן" });
    }
  };

  const handleAssignDelete = async () => {
    if (!assignModal) return;
    try {
      await api.deleteOncallAssignment(assignModal.date, assignModal.slot);
      setAssignModal(null);
      loadMonthly();
    } catch {
      setAlert({ type: "error", msg: "שגיאה במחיקת הכונן" });
    }
  };

  const handleOverrideSave = async (dept: string) => {
    if (!overrideModal) return;
    try {
      await api.setOncallOverride(overrideModal.date, overrideModal.slot, dept);
      setOverrideModal(null);
      loadMonthly();
    } catch {
      setAlert({ type: "error", msg: "שגיאה בשינוי המחלקה" });
    }
  };

  const handleOverrideDelete = async () => {
    if (!overrideModal) return;
    try {
      await api.deleteOncallOverride(overrideModal.date, overrideModal.slot);
      setOverrideModal(null);
      loadMonthly();
    } catch {
      setAlert({ type: "error", msg: "שגיאה בביטול השינוי" });
    }
  };

  const requiredAttributes = config?.required_attributes ?? [];

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const result = await parseOncallFile(file, year, employees);
      setImportPreview(result);
    } catch {
      setAlert({ type: "error", msg: "שגיאה בקריאת הקובץ" });
    }
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      await api.importOncall({ year, month, overrides: importPreview.overrides, assignments: importPreview.assignments });
      setImportPreview(null);
      loadMonthly();
      setAlert({ type: "success", msg: `יובאו ${importPreview.overrides.length} מחלקות ו-${importPreview.assignments.length} שיבוצים` });
    } catch {
      setAlert({ type: "error", msg: "שגיאה בייבוא" });
    } finally {
      setImporting(false);
    }
  };

  const handleAutoGenerate = async () => {
    setAutoGenerating(true);
    try {
      const res = await api.autoGenerateOncall(year, month, autoGenOverwrite);
      setShowAutoGenModal(false);
      loadMonthly();
      setAlert({ type: "success", msg: `שובצו ${res.generated} כוננויות אוטומטית` });
    } catch {
      setAlert({ type: "error", msg: "שגיאה בשיבוץ האוטומטי" });
    } finally {
      setAutoGenerating(false);
    }
  };

  const assignModalDay = assignModal ? days.find(d => d.date === assignModal.date) : null;
  const assignModalSlotData = assignModalDay?.slots[assignModal!.slot];
  const overrideModalDay = overrideModal ? days.find(d => d.date === overrideModal.date) : null;
  const overrideModalSlotData = overrideModalDay?.slots[overrideModal!.slot];

  const yearOptions = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 1 + i);

  return (
    <div className="min-h-screen bg-slate-50 pr-60" dir="rtl">
      <div className="max-w-full mx-auto px-6 py-6 flex flex-col gap-5">
        {/* Alert */}
        {alert && (
          <Alert type={alert.type} onClose={() => setAlert(null)}>{alert.msg}</Alert>
        )}

        {/* Config panel */}
        {showConfig && config && (
          <ConfigPanel config={config} departments={departments} columnHeaders={columnHeaders} onSave={saveConfig} />
        )}

        {/* Rotation table — styled like the printed sheet */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Printed-style header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-bold text-slate-800 tracking-wide">טבלת כוננויות</h2>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">חודש</span>
                <select
                  value={month}
                  onChange={e => setMonth(Number(e.target.value))}
                  className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  {MONTH_NAMES.map((n, i) => (
                    <option key={i + 1} value={i + 1}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">שנה</span>
                <select
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Download size={13} />}
                onClick={() => void downloadNursingOncallXlsx(days, month, year)}
                disabled={!days.length}
              >
                ייצוא
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Upload size={13} />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  ייבוא
                </Button>
                <button
                  onClick={() => setShowImportGuide(true)}
                  className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-bold flex items-center justify-center transition-colors"
                  title="מה פורמט הקובץ?"
                >
                  ?
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.ods"
                className="hidden"
                onChange={handleFileSelected}
              />
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={13} />}
                onClick={applyDefaults}
              >
                ברירת מחדל
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Wand2 size={13} />}
                onClick={() => setShowAutoGenModal(true)}
              >
                שיבוץ אוטומטי
              </Button>
              <Button
                variant={showConfig ? "primary" : "ghost"}
                size="sm"
                icon={<Settings size={13} />}
                onClick={() => setShowConfig(v => !v)}
              >
                רוטציה
              </Button>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <input
                  type="text"
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  placeholder="הדגש עובד..."
                  className="pr-8 pl-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-slate-50 w-40"
                  dir="rtl"
                />
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </div>
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">כל המחלקות</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {(empSearch || deptFilter) && (
                <button onClick={() => { setEmpSearch(""); setDeptFilter(""); }} className="text-xs text-slate-400 hover:text-slate-600">נקה</button>
              )}
              <p className="text-xs text-slate-400 mr-auto">
                לחץ על שם המחלקה לשינוי ידני · לחץ על <UserPlus size={11} className="inline" /> לשיבוץ כונן · <span className="text-amber-600">צהוב</span> = שינוי ידני
              </p>
            </div>
            <RotationTable
              days={days}
              onAssign={openAssignModal}
              onOverride={openOverrideModal}
              highlightEmp={empSearch}
              filterDept={deptFilter}
            />
            <p className="text-xs text-slate-400 text-left mt-1">
              מעודכן לתאריך: {new Date().toLocaleDateString("he-IL")}
            </p>
          </div>
        </div>

        {/* Monthly summary */}
        {days.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-800 mb-3">סיכום כוננים חודשי</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SLOTS.map(slot => {
                const assigned = days.flatMap(day => {
                  const s = day.slots[slot];
                  if (!s.assignment) return [];
                  return [{ date: day.date, ...s.assignment }];
                });
                return (
                  <div key={slot} className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-slate-600">{SLOT_LABELS[slot]}</p>
                    {assigned.length === 0 ? (
                      <p className="text-xs text-slate-400">אין שיבוצים עדיין</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {assigned.map(a => {
                          const d = new Date(a.date + "T12:00:00");
                          return (
                            <div key={a.date} className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">{d.getDate()}/{d.getMonth() + 1}</span>
                              <span className="font-medium text-slate-800">{a.employee_name}</span>
                              <span className="text-slate-400">{a.from_department}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Import guide modal */}
      {showImportGuide && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center" onClick={() => setShowImportGuide(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-800">פורמט קובץ ייבוא</p>
              <button onClick={() => setShowImportGuide(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4 text-sm">
              <p className="text-slate-600">הקובץ חייב להיות בפורמט Excel (.xlsx) או CSV. <span className="font-medium">הדרך הקלה ביותר — ייצא תחילה מהמערכת ועדכן את הקובץ.</span></p>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-slate-500 mb-1">מבנה הקובץ:</p>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="text-xs border-collapse w-full" dir="rtl">
                    <tbody>
                      <tr className="bg-slate-100">
                        <td className="border border-slate-200 px-2 py-1 font-semibold">כוננות</td>
                        <td className="border border-slate-200 px-2 py-1 font-semibold">שורה</td>
                        <td className="border border-slate-200 px-2 py-1 font-semibold text-center">01/04</td>
                        <td className="border border-slate-200 px-2 py-1 font-semibold text-center">02/04</td>
                        <td className="border border-slate-200 px-2 py-1 text-slate-400 text-center">...</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="border border-slate-200 px-2 py-1 text-slate-400" colSpan={2}>שורת יום בשבוע (אופציונלי)</td>
                        <td className="border border-slate-200 px-2 py-1 text-center text-slate-400">ג׳</td>
                        <td className="border border-slate-200 px-2 py-1 text-center text-slate-400">ד׳</td>
                        <td className="border border-slate-200 px-2 py-1 text-slate-400 text-center">...</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-200 px-2 py-1 font-medium" rowSpan={2}>כוננות ערב I</td>
                        <td className="border border-slate-200 px-2 py-1">מחלקה</td>
                        <td className="border border-slate-200 px-2 py-1 text-center">שקד</td>
                        <td className="border border-slate-200 px-2 py-1 text-center">ברוש</td>
                        <td className="border border-slate-200 px-2 py-1 text-center text-slate-400">...</td>
                      </tr>
                      <tr className="bg-slate-50/50">
                        <td className="border border-slate-200 px-2 py-1">הפעלה</td>
                        <td className="border border-slate-200 px-2 py-1 text-center">שרה כהן</td>
                        <td className="border border-slate-200 px-2 py-1 text-center"></td>
                        <td className="border border-slate-200 px-2 py-1 text-center text-slate-400">...</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-200 px-2 py-1 font-medium text-slate-400" colSpan={5}>... שורות דומות לכוננות ערב II וכוננות לילה</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <ul className="text-xs text-slate-500 flex flex-col gap-1 list-disc pr-4">
                <li>שם המחלקה בשורת <strong>מחלקה</strong> ישנה את המחלקה האחראית לאותו יום</li>
                <li>שם העובד בשורת <strong>הפעלה</strong> חייב להתאים בדיוק לשם העובד במערכת</li>
                <li>תאריכים בפורמט <strong>DD/MM</strong> (למשל: 01/04)</li>
                <li>שם הכוננות: <strong>כוננות ערב I</strong>, <strong>כוננות ערב II</strong>, <strong>כוננות לילה</strong></li>
              </ul>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center">
              <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={() => { void downloadNursingOncallXlsx(days, month, year); setShowImportGuide(false); }} disabled={!days.length}>
                ייצא לדוגמה
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowImportGuide(false)}>הבנתי</Button>
            </div>
          </div>
        </div>
      )}

      {/* Import confirmation modal */}
      {importPreview && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center" onClick={() => setImportPreview(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-800">אישור ייבוא</p>
              <button onClick={() => setImportPreview(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">שינויי מחלקה:</span>
                <span className="font-semibold text-slate-800">{importPreview.overrides.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">שיבוצי כוננים:</span>
                <span className="font-semibold text-slate-800">{importPreview.assignments.length}</span>
              </div>
              {importPreview.unmatched.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-700 font-medium mb-1">עובדים שלא נמצאו ({importPreview.unmatched.length}):</p>
                  <p className="text-xs text-amber-600">{importPreview.unmatched.join(", ")}</p>
                </div>
              )}
              <p className="text-xs text-slate-400">הנתונים הקיימים לחודש זה יוחלפו.</p>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setImportPreview(null)}>ביטול</Button>
              <Button variant="primary" size="sm" onClick={handleImportConfirm} loading={importing}>
                {importing ? "מייבא..." : "אשר ייבוא"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-generate modal */}
      {showAutoGenModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center" onClick={() => setShowAutoGenModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-800">שיבוץ אוטומטי כוננויות</p>
              <button onClick={() => setShowAutoGenModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3 text-sm text-slate-600">
              <p>המערכת תשבץ כוננויות לחודש <strong>{MONTH_NAMES[month - 1]} {year}</strong> לפי רוטציית המחלקות, תוך ניסיון לאזן את מספר הכוננויות בין העובדים.</p>
              <p className="text-xs text-slate-400">נלקח בחשבון מי ביצע הכי פחות כוננויות השנה. עובדים ללא התכונות הנדרשות לא ישובצו.</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenOverwrite}
                  onChange={e => setAutoGenOverwrite(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>החלף שיבוצים קיימים לחודש זה</span>
              </label>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowAutoGenModal(false)}>ביטול</Button>
              <Button variant="primary" size="sm" icon={<Wand2 size={13} />} onClick={handleAutoGenerate} loading={autoGenerating}>
                {autoGenerating ? "משבץ..." : "שבץ אוטומטית"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment modal */}
      {assignModal && assignModalSlotData && (
        <AssignmentModal
          date={assignModal.date}
          slot={assignModal.slot}
          department={assignModalSlotData.department}
          employees={employees}
          requiredAttributes={requiredAttributes}
          columnHeaders={columnHeaders}
          current={assignModalSlotData.assignment}
          onSave={handleAssignSave}
          onDelete={handleAssignDelete}
          onClose={() => setAssignModal(null)}
        />
      )}

      {/* Override modal */}
      {overrideModal && overrideModalSlotData && (
        <OverrideModal
          date={overrideModal.date}
          slot={overrideModal.slot}
          current={overrideModalSlotData.department}
          departments={departments}
          onSave={handleOverrideSave}
          onDelete={handleOverrideDelete}
          onClose={() => setOverrideModal(null)}
        />
      )}
    </div>
  );
}
