"use client";
import { useRef, useState, useEffect, useMemo } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import { useMode } from "@/components/ModeProvider";
import { getDepartments, exportEmployeesXlsx } from "@/lib/api";

const COL_COLORS = [
  { bg: "bg-violet-100", text: "text-violet-700", ring: "ring-violet-300" },
  { bg: "bg-sky-100",    text: "text-sky-700",    ring: "ring-sky-300" },
  { bg: "bg-emerald-100",text: "text-emerald-700",ring: "ring-emerald-300" },
  { bg: "bg-rose-100",   text: "text-rose-700",   ring: "ring-rose-300" },
  { bg: "bg-amber-100",  text: "text-amber-700",  ring: "ring-amber-300" },
  { bg: "bg-cyan-100",   text: "text-cyan-700",   ring: "ring-cyan-300" },
  { bg: "bg-pink-100",   text: "text-pink-700",   ring: "ring-pink-300" },
  { bg: "bg-indigo-100", text: "text-indigo-700", ring: "ring-indigo-300" },
  { bg: "bg-teal-100",   text: "text-teal-700",   ring: "ring-teal-300" },
];

const colAttr = (i: number) => `col_${i}`;

// ── Nursing attribute rules ────────────────────────────────────────────────────
const NURSE_HEADER = "אח/אחות";
const NURSE_SUB_HEADERS = ["אחראי משמרת", "על בסיסי"];
const ASSISTANT_HEADER = "כוח עזר";
const STUDENT_HEADER = "סטודנט";
const MUTUAL_EXCLUSION_PAIRS = [["גבר", "אישה"], ["ותיק", "צעיר"]];

const NURSING_DEFAULT_HEADERS = [
  "אח/אחות", "אחראי משמרת", "על בסיסי", "גבר", "אישה", "ותיק", "צעיר", "כוח עזר", "סטודנט",
];

function applyNursingRules(
  headers: string[],
  colIdx: number,
  currentAttrs: string[],
  nextAttrs: string[]
): string[] {
  const colOf = (name: string) => { const i = headers.indexOf(name); return i >= 0 ? i + 1 : 0; };
  const removeIdxs = (attrs: string[], ...idxs: number[]) =>
    attrs.filter(a => !idxs.filter(i => i > 0).map(colAttr).includes(a));

  const isAdding = !currentAttrs.includes(colAttr(colIdx));
  const headerName = headers[colIdx - 1] ?? "";
  const nurseIdx = colOf(NURSE_HEADER);
  const subIdxs = NURSE_SUB_HEADERS.map(colOf).filter(i => i > 0);
  const assistantIdx = colOf(ASSISTANT_HEADER);
  const studentIdx = colOf(STUDENT_HEADER);

  if (!isAdding) {
    // Unchecking nurse → also remove sub-attributes
    if (colIdx === nurseIdx) return removeIdxs(nextAttrs, ...subIdxs);
    return nextAttrs;
  }

  // Adding כוח עזר → remove nurse, sub-attrs, student
  if (assistantIdx > 0 && colIdx === assistantIdx)
    return removeIdxs(nextAttrs, nurseIdx, ...subIdxs, studentIdx);
  // Adding סטודנט → remove nurse, sub-attrs, assistant
  if (studentIdx > 0 && colIdx === studentIdx)
    return removeIdxs(nextAttrs, nurseIdx, ...subIdxs, assistantIdx);
  // Adding nurse → remove assistant and student
  if (nurseIdx > 0 && colIdx === nurseIdx)
    return removeIdxs(nextAttrs, assistantIdx, studentIdx);
  // Adding sub-attribute → auto-add nurse, remove assistant and student
  if (NURSE_SUB_HEADERS.includes(headerName)) {
    let result = nextAttrs;
    if (nurseIdx > 0 && !result.includes(colAttr(nurseIdx)))
      result = [...result, colAttr(nurseIdx)];
    return removeIdxs(result, assistantIdx, studentIdx);
  }
  // Mutual exclusion pairs (גבר/אישה, ותיק/צעיר)
  for (const [a, b] of MUTUAL_EXCLUSION_PAIRS) {
    const aIdx = colOf(a), bIdx = colOf(b);
    if (colIdx === aIdx && bIdx > 0) return removeIdxs(nextAttrs, bIdx);
    if (colIdx === bIdx && aIdx > 0) return removeIdxs(nextAttrs, aIdx);
  }
  return nextAttrs;
}

function isAttrDisabled(headers: string[], colIdx: number, empAttrs: string[]): boolean {
  const headerName = headers[colIdx - 1] ?? "";
  if (NURSE_SUB_HEADERS.includes(headerName)) {
    const nurseIdx = headers.indexOf(NURSE_HEADER) + 1;
    return nurseIdx > 0 && !empAttrs.includes(colAttr(nurseIdx));
  }
  return false;
}

// ── Editable column header cell ───────────────────────────────────────────────
function EditableHeader({
  value,
  colIndex,
  onRename,
  onDelete,
}: {
  value: string;
  colIndex: number; // 0-based
  onRename: (index: number, name: string) => Promise<void>;
  onDelete: (index: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const c = COL_COLORS[colIndex % COL_COLORS.length];

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = async () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) { setDraft(value); return; }
    await onRename(colIndex, trimmed);
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try { await onDelete(colIndex); } finally { setDeleting(false); setConfirmDelete(false); }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        dir="rtl"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className={`w-full text-center text-xs font-semibold px-2 py-1 rounded-lg border-2 border-blue-400 focus:outline-none ${c.bg} ${c.text}`}
        style={{ minWidth: "80px" }}
      />
    );
  }

  return (
    <div className="group flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="לחץ לשינוי שם"
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:ring-2 ${c.ring} ${c.bg} ${c.text}`}
      >
        {value}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0">
          <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474Z" />
          <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V8a.75.75 0 0 1 1.5 0v3.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H8a.75.75 0 0 1 0 1.5H4.75Z" />
        </svg>
      </button>
      <button
        type="button"
        disabled={deleting}
        onClick={handleDelete}
        onBlur={() => setConfirmDelete(false)}
        title={confirmDelete ? "לחץ שוב לאישור מחיקה" : "מחק עמודה"}
        className={`text-[10px] font-medium px-2 py-0.5 rounded transition-all opacity-0 group-hover:opacity-100 ${
          confirmDelete
            ? "bg-red-100 text-red-600 ring-1 ring-red-300"
            : "text-slate-400 hover:text-red-500 hover:bg-red-50"
        } disabled:opacity-40`}
      >
        {deleting ? "מוחק…" : confirmDelete ? "בטוח?" : "מחק"}
      </button>
    </div>
  );
}

// ── Add column header cell ────────────────────────────────────────────────────
function AddColumnHeader({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed) { setAdding(false); setDraft(""); return; }
    setSaving(true);
    try {
      await onAdd(trimmed);
      setDraft("");
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  if (adding) {
    return (
      <th className="px-2 py-3 text-center sticky top-0 bg-slate-50 z-10" style={{ minWidth: "120px" }}>
        <input
          ref={inputRef}
          dir="rtl"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setAdding(false); setDraft(""); } }}
          disabled={saving}
          placeholder="שם תכונה"
          className="w-full text-center text-xs font-semibold px-2 py-1 rounded-lg border-2 border-blue-400 focus:outline-none bg-blue-50 text-blue-700 placeholder-blue-300"
        />
      </th>
    );
  }

  return (
    <th className="px-2 py-3 text-center sticky top-0 bg-slate-50 z-10 w-10">
      <button
        type="button"
        onClick={() => setAdding(true)}
        title="הוסף תכונה חדשה"
        className="w-7 h-7 inline-flex items-center justify-center rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-100 transition-all font-bold text-base"
      >
        +
      </button>
    </th>
  );
}

// ── Shifts per week cell ──────────────────────────────────────────────────────
function ShiftsPerWeekCell({
  empId,
  value,
  onUpdate,
}: {
  empId: string;
  value?: number;
  onUpdate: (id: string, val: number) => Promise<void>;
}) {
  const display = value ?? 6;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(display));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value ?? 6)); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = async () => {
    setEditing(false);
    const num = parseInt(draft, 10);
    if (isNaN(num) || num < 1) { setDraft(String(value ?? 6)); return; }
    if (num === (value ?? 6)) return;
    await onUpdate(empId, num);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={1}
        max={14}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") { setDraft(String(value ?? 6)); setEditing(false); }
        }}
        className="w-12 text-center text-xs font-semibold px-1 py-1 rounded-lg border-2 border-blue-400 focus:outline-none bg-blue-50 text-blue-700"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="לחץ לשינוי מספר משמרות שבועי"
      className="w-8 h-8 rounded-full inline-flex items-center justify-center text-xs font-bold text-slate-600 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 transition-all"
    >
      {display}
    </button>
  );
}

// ── Home department dropdown cell ─────────────────────────────────────────────
function HomeDepartmentCell({
  empId,
  value,
  departments,
  onUpdate,
}: {
  empId: string;
  value?: string | null;
  departments: string[];
  onUpdate: (id: string, dept: string | null) => Promise<void>;
}) {
  const current = value ?? "";
  return (
    <select
      value={current}
      onChange={(e) => {
        const next = e.target.value || null;
        if ((next ?? "") === current) return;
        onUpdate(empId, next);
      }}
      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-all min-w-[110px]"
      dir="rtl"
    >
      <option value="">— לא שויך —</option>
      {departments.map((dep) => (
        <option key={dep} value={dep}>{dep}</option>
      ))}
    </select>
  );
}

// ── Main table ────────────────────────────────────────────────────────────────
export default function EmployeeTable() {
  const {
    employees, columnHeaders, loading, error,
    importCsv, updateEmployee, activateEmployee, deactivateEmployee, removeEmployee,
    renameColumnHeader, addColumnHeader, deleteColumnHeader, seedDefaultEmployees, clearAllEmployees,
  } = useEmployees();

  const { mode } = useMode();
  const isNursing = mode.startsWith("nursing");
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    if (isNursing) getDepartments().then(setDepartments).catch(() => {});
  }, [isNursing]);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [initializingNursing, setInitializingNursing] = useState(false);
  const [seedingEmployees, setSeedingEmployees] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // search & filter state
  const [nameSearch, setNameSearch] = useState("");
  const [attrFilter, setAttrFilter] = useState<Set<string>>(new Set());
  const [deptFilter, setDeptFilter] = useState<Set<string>>(new Set());

  const toggleAttrFilter = (attr: string) =>
    setAttrFilter(prev => {
      const next = new Set(prev);
      next.has(attr) ? next.delete(attr) : next.add(attr);
      return next;
    });

  const toggleDeptFilter = (dept: string) =>
    setDeptFilter(prev => {
      const next = new Set(prev);
      next.has(dept) ? next.delete(dept) : next.add(dept);
      return next;
    });

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (nameSearch && !emp.name.includes(nameSearch)) return false;
      if (attrFilter.size > 0) {
        for (const attr of attrFilter) {
          if (!emp.attributes.includes(attr)) return false;
        }
      }
      if (deptFilter.size > 0) {
        if (!deptFilter.has(emp.home_department ?? "")) return false;
      }
      return true;
    });
  }, [employees, nameSearch, attrFilter, deptFilter]);

  const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls", ".ods"];
  const isAccepted = (f: File) =>
    ACCEPTED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext));

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!isAccepted(file)) {
      setImportError(`סוג קובץ לא נתמך. יש להשתמש ב: ${ACCEPTED_EXTENSIONS.join(", ")}`);
      return;
    }
    setImporting(true); setImportError(null); setImportSuccess(null);
    try {
      const result = await importCsv(file);
      let msg = `יובאו ${result.imported} עובדים בהצלחה`;
      if (result.invalid_departments?.length) {
        msg += ` · מחלקות לא מוכרות (הוסרו): ${result.invalid_departments.join(", ")}`;
      }
      setImportSuccess(msg);
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleToggleAttr = async (empId: string, currentAttrs: string[], colIdx: number) => {
    const attr = colAttr(colIdx);
    const key = `${empId}-${colIdx}`;
    const rawNext = currentAttrs.includes(attr)
      ? currentAttrs.filter((a) => a !== attr)
      : [...currentAttrs, attr];
    const next = applyNursingRules(columnHeaders, colIdx, currentAttrs, rawNext);
    setSavingCell(key);
    try {
      await updateEmployee(empId, { attributes: next });
    } finally {
      setSavingCell(null);
    }
  };

  const handleUpdateShiftsPerWeek = async (empId: string, val: number) => {
    await updateEmployee(empId, { max_shifts_per_week: val });
  };

  const handleInitNursingDefaults = async () => {
    setInitializingNursing(true);
    try {
      for (const header of NURSING_DEFAULT_HEADERS) {
        await addColumnHeader(header);
      }
    } finally {
      setInitializingNursing(false);
    }
  };

  const handleSeedEmployees = async () => {
    setSeedingEmployees(true);
    try {
      await seedDefaultEmployees();
    } catch {
      // already have employees or other error — ignore silently
    } finally {
      setSeedingEmployees(false);
    }
  };

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl shimmer" />)}
    </div>
  );
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{error}</div>
  );

  const numCols = columnHeaders.length;

  return (
    <div className="space-y-6 fade-in">
      {/* Upload */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
          dragging ? "border-blue-500 bg-blue-50 scale-[1.01]" : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f && isAccepted(f)) handleFile(f); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.ods" className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <div>
            <p className="text-slate-700 font-semibold text-base">
              {importing ? "מייבא נתונים…" : "גרור קובץ לכאן"}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              CSV · XLSX · XLS · ODS · שורה 1 = כותרות · עמודה 1 = שם · עמודות 2+ = V להרשאה
            </p>
          </div>
          {!importing && (
            <span className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors">
              בחר קובץ
            </span>
          )}
        </div>
      </div>

      {importError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{importError}</div>
      )}
      {importSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700 font-medium">{importSuccess}</div>
      )}

      {/* Search & attribute filter */}
      {employees.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
          {/* Name search */}
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              dir="rtl"
              placeholder="חיפוש לפי שם עובד..."
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            />
            {nameSearch && (
              <button type="button" onClick={() => setNameSearch("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 text-xs">✕</button>
            )}
          </div>

          {/* Attribute filter chips */}
          {columnHeaders.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold text-slate-500">סנן לפי תכונה:</span>
              {columnHeaders.map((header, i) => {
                const attr = colAttr(i + 1);
                const active = attrFilter.has(attr);
                const c = COL_COLORS[i % COL_COLORS.length];
                return (
                  <button
                    key={attr}
                    type="button"
                    onClick={() => toggleAttrFilter(attr)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                      active
                        ? `${c.bg} ${c.text} ring-2 ${c.ring} border-transparent shadow-sm`
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {header}
                  </button>
                );
              })}
              {attrFilter.size > 0 && (
                <button type="button" onClick={() => setAttrFilter(new Set())}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors pr-1">
                  נקה הכל ✕
                </button>
              )}
            </div>
          )}

          {/* Department filter chips (nursing only) */}
          {isNursing && departments.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold text-slate-500">סנן לפי מחלקה:</span>
              {departments.map((dep) => {
                const active = deptFilter.has(dep);
                return (
                  <button
                    key={dep}
                    type="button"
                    onClick={() => toggleDeptFilter(dep)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                      active
                        ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300 border-transparent shadow-sm"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {dep}
                  </button>
                );
              })}
              {deptFilter.size > 0 && (
                <button type="button" onClick={() => setDeptFilter(new Set())}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors pr-1">
                  נקה ✕
                </button>
              )}
            </div>
          )}

          {/* Results count */}
          {(nameSearch || attrFilter.size > 0 || deptFilter.size > 0) && (
            <p className="text-xs text-slate-500">
              מציג <span className="font-semibold text-blue-600">{filteredEmployees.length}</span> מתוך {employees.length} עובדים
            </p>
          )}
        </div>
      )}

      {/* Nursing defaults init banner — shown when employees exist but no columns defined */}
      {employees.length > 0 && numCols === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-800">לא הוגדרו תכונות לעובדים</p>
            <p className="text-xs text-blue-600 mt-0.5">אפשר לאתחל את תכונות ברירת המחדל לצוות סיעוד</p>
          </div>
          <button
            type="button"
            disabled={initializingNursing}
            onClick={handleInitNursingDefaults}
            className="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {initializingNursing ? "מאתחל..." : "אתחל תכונות סיעוד"}
          </button>
        </div>
      )}

      {/* Table */}
      {employees.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">רשימת עובדים</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">לחץ על שם או כותרת לעריכה</span>
              <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                {filteredEmployees.length} / {employees.length} עובדים
              </span>
              <button
                type="button"
                onClick={async () => { try { await exportEmployeesXlsx(filteredEmployees.map(e => e.id)); } catch {} }}
                className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-all font-medium"
                title="ייצא לאקסל"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                  <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                </svg>
                ייצא Excel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm("למחוק את כל העובדים בתצוגה זו?")) return;
                  await clearAllEmployees();
                }}
                className="text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all"
              >
                נקה הכל
              </button>
            </div>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: "520px", overflowY: "auto" }}>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-right font-semibold text-slate-600 whitespace-nowrap sticky top-0 bg-slate-50 z-10 w-max">
                    שם עובד
                  </th>
                  {Array.from({ length: numCols }, (_, i) => (
                    <th key={i} className="px-2 py-3 text-center sticky top-0 bg-slate-50 z-10 min-w-[100px]">
                      <EditableHeader
                        value={columnHeaders[i]}
                        colIndex={i}
                        onRename={renameColumnHeader}
                        onDelete={deleteColumnHeader}
                      />
                    </th>
                  ))}
                  {isNursing && (
                    <th className="px-2 py-3 text-center sticky top-0 bg-slate-50 z-10 min-w-[120px]">
                      <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">מחלקת אם</span>
                    </th>
                  )}
                  <th className="px-2 py-3 text-center sticky top-0 bg-slate-50 z-10 min-w-[80px]">
                    <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">משמרות/שבוע</span>
                  </th>
                  <AddColumnHeader onAdd={addColumnHeader} />
                  <th className="px-3 py-3 sticky top-0 bg-slate-50 z-10 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, idx) => (
                  <tr
                    key={emp.id}
                    className={`border-b border-slate-50 transition-colors hover:bg-blue-50/30 ${
                      emp.active === false ? "opacity-50" : idx % 2 === 0 ? "" : "bg-slate-50/50"
                    }`}
                  >
                    {/* Active toggle + editable name */}
                    <td className="px-5 py-2.5 whitespace-nowrap w-max">
                      <div className="flex items-start gap-2">
                        <div className="pt-1.5">
                          <ActiveToggle
                            empId={emp.id}
                            active={emp.active !== false}
                            inactiveReason={emp.inactive_reason}
                            inactiveSince={emp.inactive_since}
                            onActivate={activateEmployee}
                            onDeactivate={deactivateEmployee}
                          />
                        </div>
                        <div className="flex flex-col">
                          <EmployeeNameCell
                            empId={emp.id}
                            name={emp.name}
                            inactive={emp.active === false}
                            onRename={(id, name) => updateEmployee(id, { name })}
                          />
                          {emp.active === false && (emp.inactive_reason || emp.inactive_since) && (
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {emp.inactive_since && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  מאז {emp.inactive_since}
                                </span>
                              )}
                              {emp.inactive_reason && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-50 text-red-400 border border-red-100 font-medium truncate max-w-[160px]">
                                  {emp.inactive_reason}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Attribute toggle cells */}
                    {Array.from({ length: numCols }, (_, i) => {
                      const colIdx = i + 1;
                      const attr = colAttr(colIdx);
                      const checked = emp.attributes.includes(attr);
                      const key = `${emp.id}-${colIdx}`;
                      const isSaving = savingCell === key;
                      const disabled = isSaving || isAttrDisabled(columnHeaders, colIdx, emp.attributes);
                      const c = COL_COLORS[i % COL_COLORS.length];
                      return (
                        <td key={i} className={`px-2 py-2.5 text-center ${isAttrDisabled(columnHeaders, colIdx, emp.attributes) ? "opacity-30" : ""}`}>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => handleToggleAttr(emp.id, emp.attributes, colIdx)}
                            title={isAttrDisabled(columnHeaders, colIdx, emp.attributes) ? `דורש ${NURSE_HEADER}` : checked ? "לחץ להסרת הרשאה" : "לחץ להוספת הרשאה"}
                            className={`w-8 h-8 rounded-full inline-flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 disabled:opacity-50 ${
                              checked
                                ? `${c.bg} ${c.text} hover:ring-2 ${c.ring} shadow-sm`
                                : "text-slate-200 hover:bg-slate-100 hover:text-slate-400"
                            }`}
                          >
                            {isSaving ? (
                              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                              </svg>
                            ) : checked ? (
                              <svg viewBox="0 0 10 10" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1.5 5l2.5 2.5 4.5-4.5"/>
                              </svg>
                            ) : (
                              <span className="text-base leading-none">·</span>
                            )}
                          </button>
                        </td>
                      );
                    })}

                    {/* Home department cell (nursing only) */}
                    {isNursing && (
                      <td className="px-2 py-2.5 text-center">
                        <HomeDepartmentCell
                          empId={emp.id}
                          value={emp.home_department}
                          departments={departments}
                          onUpdate={(id, dept) => updateEmployee(id, { home_department: dept })}
                        />
                      </td>
                    )}

                    {/* Shifts per week cell */}
                    <td className="px-2 py-2.5 text-center">
                      <ShiftsPerWeekCell
                        empId={emp.id}
                        value={emp.max_shifts_per_week}
                        onUpdate={handleUpdateShiftsPerWeek}
                      />
                    </td>

                    {/* Empty cell under the + column */}
                    <td />

                    {/* Delete */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => removeEmployee(emp.id)}
                        className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all inline-flex items-center justify-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredEmployees.length === 0 && employees.length > 0 && (
        <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-2xl border border-slate-100">
          לא נמצאו עובדים התואמים את החיפוש
        </div>
      )}

      {employees.length === 0 && !importing && !importSuccess && (
        <div className="text-center py-16 text-slate-400">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <p className="font-medium">אין עובדים עדיין</p>
          <p className="text-sm mt-1">ייבא קובץ להתחלה</p>
          <button
            type="button"
            disabled={seedingEmployees}
            onClick={handleSeedEmployees}
            className="mt-4 px-5 py-2 bg-slate-700 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {seedingEmployees ? "מוסיף עובדים..." : "הוסף עובדים לדוגמה"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Active / inactive toggle with reason popover ──────────────────────────────
function ActiveToggle({
  empId,
  active,
  inactiveReason,
  inactiveSince,
  onActivate,
  onDeactivate,
}: {
  empId: string;
  active: boolean;
  inactiveReason?: string;
  inactiveSince?: string;
  onActivate: (id: string) => Promise<void>;
  onDeactivate: (id: string, reason: string) => Promise<void>;
}) {
  const [showPopover, setShowPopover] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (showPopover) inputRef.current?.focus(); }, [showPopover]);

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false); setReason("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPopover]);

  const handleDeactivate = async () => {
    setSaving(true);
    try { await onDeactivate(empId, reason.trim()); setShowPopover(false); setReason(""); }
    finally { setSaving(false); }
  };

  const handleActivate = async () => {
    setSaving(true);
    try { await onActivate(empId); } finally { setSaving(false); }
  };

  return (
    <div className="relative shrink-0" ref={popoverRef}>
      {/* Dot button */}
      {active ? (
        <button
          type="button"
          onClick={() => setShowPopover((v) => !v)}
          disabled={saving}
          title="פעיל — לחץ להשבתה"
          className="w-3 h-3 rounded-full bg-emerald-400 hover:bg-emerald-500 transition-colors shadow-sm focus:outline-none disabled:opacity-50"
        />
      ) : (
        <div className="group/inactive">
          <button
            type="button"
            onClick={handleActivate}
            disabled={saving}
            title="לא פעיל — לחץ להפעלה"
            className="w-3 h-3 rounded-full bg-red-300 hover:bg-emerald-400 transition-colors focus:outline-none disabled:opacity-50"
          />
          {/* Tooltip — shown on hover when there is a reason or date */}
          {(inactiveReason || inactiveSince) && (
            <div className="absolute right-5 top-0 z-30 pointer-events-none opacity-0 group-hover/inactive:opacity-100 transition-opacity duration-150">
              <div className="bg-slate-800 text-white rounded-xl shadow-xl px-3 py-2 text-xs min-w-[160px] max-w-[220px]">
                {inactiveReason && <p className="font-medium leading-snug">{inactiveReason}</p>}
                {inactiveSince && (
                  <p className={`text-slate-400 ${inactiveReason ? "mt-1" : ""}`}>
                    מאז {inactiveSince}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deactivate popover */}
      {showPopover && (
        <div className="absolute right-0 top-5 z-40 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 min-w-[220px]">
          {/* Arrow */}
          <div className="absolute -top-2 right-1 w-4 h-4 bg-white border-l border-t border-slate-200 rotate-45" />
          <p className="text-xs font-bold text-slate-700 mb-1">השבתת עובד</p>
          <p className="text-[11px] text-slate-500 mb-3">העובד לא יקבל שיבוצים. ניתן להפעיל מחדש בכל עת.</p>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">סיבה (אופציונלי)</label>
          <input
            ref={inputRef}
            dir="rtl"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleDeactivate(); if (e.key === "Escape") { setShowPopover(false); setReason(""); } }}
            placeholder="חופשה, מחלה, סיום עבודה…"
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 mb-3 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 bg-slate-50"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDeactivate}
              disabled={saving}
              className="flex-1 text-xs py-1.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {saving ? "…" : "השבת"}
            </button>
            <button
              onClick={() => { setShowPopover(false); setReason(""); }}
              className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Employee name cell ────────────────────────────────────────────────────────
function EmployeeNameCell({
  empId,
  name,
  inactive,
  onRename,
}: {
  empId: string;
  name: string;
  inactive?: boolean;
  onRename: (id: string, name: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(name);
  useEffect(() => { setDraft(name); }, [name]);

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) { setDraft(name); return; }
    await onRename(empId, trimmed);
  };

  return (
    <input
      dir="rtl"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setDraft(name); }}
      className={`min-w-[120px] bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white rounded-lg px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all whitespace-nowrap ${
        inactive ? "text-slate-400 line-through" : "text-slate-800"
      }`}
    />
  );
}
