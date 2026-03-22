"use client";
import { useRef, useState, useEffect } from "react";
import { useEmployees } from "@/hooks/useEmployees";

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

// ── Main table ────────────────────────────────────────────────────────────────
export default function EmployeeTable() {
  const {
    employees, columnHeaders, loading, error,
    importCsv, updateEmployee, removeEmployee,
    renameColumnHeader, addColumnHeader, deleteColumnHeader,
  } = useEmployees();

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setImportSuccess(`יובאו ${result.imported} עובדים בהצלחה`);
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
    const next = currentAttrs.includes(attr)
      ? currentAttrs.filter((a) => a !== attr)
      : [...currentAttrs, attr];
    setSavingCell(key);
    try {
      await updateEmployee(empId, { attributes: next });
    } finally {
      setSavingCell(null);
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

      {/* Table */}
      {employees.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">רשימת עובדים</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">לחץ על שם או כותרת לעריכה</span>
              <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                {employees.length} עובדים
              </span>
            </div>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: "520px", overflowY: "auto" }}>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-right font-semibold text-slate-600 whitespace-nowrap sticky top-0 bg-slate-50 z-10">
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
                  <AddColumnHeader onAdd={addColumnHeader} />
                  <th className="px-3 py-3 sticky top-0 bg-slate-50 z-10 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, idx) => (
                  <tr
                    key={emp.id}
                    className={`border-b border-slate-50 transition-colors hover:bg-blue-50/30 ${idx % 2 === 0 ? "" : "bg-slate-50/50"}`}
                  >
                    {/* Editable name */}
                    <td className="px-5 py-2.5">
                      <EmployeeNameCell
                        empId={emp.id}
                        name={emp.name}
                        onRename={(id, name) => updateEmployee(id, { name })}
                      />
                    </td>

                    {/* Attribute toggle cells */}
                    {Array.from({ length: numCols }, (_, i) => {
                      const colIdx = i + 1;
                      const attr = colAttr(colIdx);
                      const checked = emp.attributes.includes(attr);
                      const key = `${emp.id}-${colIdx}`;
                      const isSaving = savingCell === key;
                      const c = COL_COLORS[i % COL_COLORS.length];
                      return (
                        <td key={i} className="px-2 py-2.5 text-center">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleToggleAttr(emp.id, emp.attributes, colIdx)}
                            title={checked ? "לחץ להסרת הרשאה" : "לחץ להוספת הרשאה"}
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
        </div>
      )}
    </div>
  );
}

// ── Employee name cell ────────────────────────────────────────────────────────
function EmployeeNameCell({
  empId,
  name,
  onRename,
}: {
  empId: string;
  name: string;
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
      className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white rounded-lg px-2 py-1 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all whitespace-nowrap"
    />
  );
}
