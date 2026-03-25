"use client";

import { useState, useRef } from "react";
import { useConstraints } from "@/hooks/useConstraints";
import { useEmployees } from "@/hooks/useEmployees";
import type { Constraint, CreateConstraintPayload } from "@/lib/types";
import { Alert, Badge, Button, Input, TabButton, TabsContainer } from "@/components/ui";
import { X, Pencil, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FolderOpen, AlertTriangle, Plus, List, Calendar, CheckCircle2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEB_DAYS  = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת"];
const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני",
                    "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function formatDateHebrew(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

// ---------------------------------------------------------------------------
// Grouping consecutive constraints
// ---------------------------------------------------------------------------

interface ConstraintGroup {
  employee_name: string;
  reason: string;
  items: Constraint[]; // sorted by date, all consecutive
}

function isNextDay(isoA: string, isoB: string) {
  const d = new Date(isoA);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10) === isoB;
}

function groupConstraints(constraints: Constraint[]): ConstraintGroup[] {
  const sorted = [...constraints].sort((a, b) => {
    if (a.employee_name !== b.employee_name) return a.employee_name.localeCompare(b.employee_name, "he");
    const ra = a.reason ?? "", rb = b.reason ?? "";
    if (ra !== rb) return ra.localeCompare(rb, "he");
    return a.date.localeCompare(b.date);
  });
  const groups: ConstraintGroup[] = [];
  for (const c of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.employee_name === c.employee_name && (last.reason ?? "") === (c.reason ?? "") &&
        isNextDay(last.items[last.items.length - 1].date, c.date)) {
      last.items.push(c);
    } else {
      groups.push({ employee_name: c.employee_name, reason: c.reason ?? "", items: [c] });
    }
  }
  return groups;
}

function displayGroupDates(items: Constraint[]): string {
  if (items.length === 1) return formatDateHebrew(items[0].date);
  return `${formatDateHebrew(items[0].date)} — ${formatDateHebrew(items[items.length - 1].date)}`;
}

// Sunday = 0 in JS, but Israel week starts Sunday too so we use 0-based as-is
function firstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

// ---------------------------------------------------------------------------
// Manual add form — now accepts free-text date expression
// ---------------------------------------------------------------------------


function ConstraintForm({ initial, onSubmit, onCancel, submitLabel = "הוסף", employeeNames = [] }: {
  initial?: Partial<CreateConstraintPayload>;
  onSubmit: (data: CreateConstraintPayload) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  employeeNames?: string[];
}) {
  const [name,      setName]      = useState(initial?.employee_name ?? "");
  const [nameOpen,  setNameOpen]  = useState(false);
  const [dateFrom,  setDateFrom]  = useState(initial?.date ?? "");
  const [dateTo,    setDateTo]    = useState("");
  const [reason,    setReason]    = useState(initial?.reason ?? "");
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [namePopupStyle, setNamePopupStyle] = useState<React.CSSProperties>({});

  const openNameDropdown = () => {
    if (nameInputRef.current) {
      const rect = nameInputRef.current.getBoundingClientRect();
      setNamePopupStyle({ position: "fixed", top: rect.bottom + 4, right: window.innerWidth - rect.right, minWidth: rect.width });
    }
    setNameOpen(true);
  };

  const filteredNames = employeeNames.filter(n => !name.trim() || n.toLowerCase().includes(name.toLowerCase()));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim())     { setErr("שם עובד הוא שדה חובה"); return; }
    if (!dateFrom.trim()) { setErr("תאריך הוא שדה חובה");   return; }
    const dateValue = dateTo.trim() ? `${dateFrom} - ${dateTo}` : dateFrom;
    setSaving(true); setErr(null);
    try {
      await onSubmit({ employee_name: name.trim(), date: dateValue, reason: reason.trim() });
      if (!initial) { setName(""); setDateFrom(""); setDateTo(""); setReason(""); }
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" dir="rtl">
      {err && <Alert type="error" onClose={() => setErr(null)}>{err}</Alert>}
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">שם עובד *</label>
          <div className="relative">
            <Input
              ref={nameInputRef}
              value={name}
              onChange={e => { setName(e.target.value); setNameOpen(true); }}
              onFocus={openNameDropdown}
              placeholder='ד"ר כהן'
              autoComplete="off"
            />
            {nameOpen && filteredNames.length > 0 && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNameOpen(false)} />
                <div style={namePopupStyle} className="z-[9999] bg-white rounded-xl shadow-xl border border-slate-200 max-h-52 overflow-y-auto" dir="rtl">
                  {filteredNames.map(n => (
                    <button key={n} type="button"
                      onClick={() => { setName(n); setNameOpen(false); }}
                      className="w-full text-right px-3 py-2 text-sm hover:bg-blue-50 transition-colors text-slate-700">
                      {n}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">תאריך *</label>
          <div className="flex items-center gap-2" dir="ltr">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <span className="text-xs text-slate-400 shrink-0">עד</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={e => setDateTo(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">סיבה (אופציונלי)</label>
          <Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="חופשה, מחלה..." />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "שומר..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>ביטול</Button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// CSV import panel (without format section — shown via ? popup)
// ---------------------------------------------------------------------------

function CsvImportPanel({ onImport }: { onImport: (file: File, mode: "replace"|"append") => Promise<void> }) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [mode,     setMode]     = useState<"replace"|"append">("replace");
  const [status,   setStatus]   = useState<{type:"success"|"error";msg:string}|null>(null);
  const [importing,setImporting]= useState(false);

  const ACCEPTED = [".csv", ".xlsx", ".xls", ".ods"];
  const isAccepted = (f: File) => ACCEPTED.some(ext => f.name.toLowerCase().endsWith(ext));

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!isAccepted(file)) {
      setStatus({ type: "error", msg: `סוג קובץ לא נתמך. יש להשתמש ב: ${ACCEPTED.join(", ")}` });
      return;
    }
    setImporting(true); setStatus(null);
    try {
      await onImport(file, mode);
      setStatus({ type: "success", msg: "הקובץ יובא בהצלחה" });
    } catch (err) { setStatus({ type: "error", msg: (err as Error).message }); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex gap-4 items-center">
        <span className="text-sm font-medium text-slate-600">מצב ייבוא:</span>
        {(["replace","append"] as const).map(m => (
          <label key={m} className="flex items-center gap-1.5 cursor-pointer text-sm">
            <input type="radio" name="import-mode" checked={mode===m} onChange={()=>setMode(m)} className="accent-blue-600" />
            {m==="replace" ? "החלף הכל" : "הוסף לקיים"}
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={`inline-flex items-center gap-2 self-start px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
          importing ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
          <span className="inline-flex items-center gap-1.5">{importing ? "מייבא..." : <><FolderOpen className="w-4 h-4" /> בחר קובץ</>}</span>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.ods" className="hidden" disabled={importing} onChange={handleFile} />
        </label>
        <span className="text-xs text-slate-400">CSV, XLSX, XLS, ODS</span>
        {mode==="replace" && <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium"><AlertTriangle className="w-3.5 h-3.5" /> יחליף את כל ההסתייגויות הקיימות</span>}
      </div>

      {status && <Alert type={status.type} onClose={()=>setStatus(null)}>{status.msg}</Alert>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Format popup modal
// ---------------------------------------------------------------------------

function FormatPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-800">פורמט קובץ נדרש</h3>
          <Button variant="ghost" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500"><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-600">פורמטי קובץ נתמכים: <span className="font-medium">CSV / XLSX / XLS / ODS</span></p>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr className="bg-slate-200">
                  <th className="border border-slate-300 px-3 py-2 text-right">שם עובד</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">תאריך</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">סיבה</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-300 px-3 py-1.5">ד&quot;ר כהן</td>
                  <td className="border border-slate-300 px-3 py-1.5">05/06/2026</td>
                  <td className="border border-slate-300 px-3 py-1.5">חופשה</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 px-3 py-1.5">ד&quot;ר לוי</td>
                  <td className="border border-slate-300 px-3 py-1.5">01/07/2026 - 05/07/2026</td>
                  <td className="border border-slate-300 px-3 py-1.5">חופשה</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-1.5">ד&quot;ר מזרחי</td>
                  <td className="border border-slate-300 px-3 py-1.5">10/07/2026, 15/07/2026 - 17/07/2026</td>
                  <td className="border border-slate-300 px-3 py-1.5"></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">פורמטי תאריך נתמכים: DD/MM/YYYY | YYYY-MM-DD | DD.MM.YYYY</p>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
          <Button variant="secondary" onClick={onClose} className="w-full">סגור</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add constraint modal
// ---------------------------------------------------------------------------

function AddModal({ onSubmit, onClose, employeeNames = [] }: {
  onSubmit: (data: CreateConstraintPayload) => Promise<void>;
  onClose: () => void;
  employeeNames?: string[];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-800">הוספת הסתייגות ידנית</h3>
            <p className="text-xs text-slate-400 mt-0.5">ניתן להזין תאריך בודד, טווח תאריכים, או שילוב מופרד בפסיק</p>
          </div>
          <Button variant="ghost" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500"><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-5">
          <ConstraintForm onSubmit={onSubmit} onCancel={onClose} employeeNames={employeeNames} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import modal
// ---------------------------------------------------------------------------

function ImportModal({ onImport, onClose }: {
  onImport: (file: File, mode: "replace"|"append") => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-800">ייבוא הסתייגויות מקובץ</h3>
          <Button variant="ghost" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500"><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-5">
          <CsvImportPanel onImport={onImport} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table row with inline edit
// ---------------------------------------------------------------------------

function ConstraintRow({ constraint, onUpdate, onDelete }: {
  constraint: Constraint;
  onUpdate: (id: string, data: Partial<CreateConstraintPayload>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const [editing,  setEditing]  = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`למחוק את ההסתייגות של ${constraint.employee_name} בתאריך ${formatDateHebrew(constraint.date)}?`)) return;
    setDeleting(true);
    try { await onDelete(constraint.id); } finally { setDeleting(false); }
  };

  if (editing) return (
    <tr className="bg-blue-50">
      <td colSpan={4} className="px-4 py-3">
        <ConstraintForm
          initial={{ employee_name: constraint.employee_name, date: constraint.date, reason: constraint.reason }}
          onSubmit={async data => { await onUpdate(constraint.id, data); setEditing(false); }}
          onCancel={() => setEditing(false)}
          submitLabel="שמור" />
      </td>
    </tr>
  );

  return (
    <tr className="hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-slate-800">{constraint.employee_name}</td>
      <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">{formatDateHebrew(constraint.date)}</td>
      <td className="px-4 py-3 text-sm text-slate-500">
        {constraint.reason
          ? <Badge className="bg-purple-100 text-purple-700 border-transparent">{constraint.reason}</Badge>
          : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2 justify-end">
          <Button variant="icon" size="compact" onClick={()=>setEditing(true)}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button variant="icon" size="compact" onClick={handleDelete} disabled={deleting}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Grouped table row
// ---------------------------------------------------------------------------

function GroupedRow({ group, onDelete, onUpdate, employeeNames = [] }: {
  group: ConstraintGroup;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<CreateConstraintPayload>) => Promise<void>;
  employeeNames?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const isRange = group.items.length > 1;

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`למחוק הסתייגות של ${group.employee_name} בתאריך ${label}?`)) return;
    setDeleting(id);
    try { await onDelete(id); } finally { setDeleting(null); }
  };

  if (!isRange && editing) return (
    <tr className="bg-blue-50">
      <td colSpan={4} className="px-4 py-3">
        <ConstraintForm
          initial={{ employee_name: group.employee_name, date: group.items[0].date, reason: group.reason }}
          onSubmit={async data => { await onUpdate(group.items[0].id, data); setEditing(false); }}
          onCancel={() => setEditing(false)}
          submitLabel="שמור"
          employeeNames={employeeNames} />
      </td>
    </tr>
  );

  return (
    <>
      <tr className="hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
        <td className="px-4 py-3 text-sm font-medium text-slate-800">{group.employee_name}</td>
        <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">
          <div className="flex items-center gap-2">
            {displayGroupDates(group.items)}
            {isRange && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">
                {group.items.length} ימים
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-slate-500">
          {group.reason
            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{group.reason}</span>
            : <span className="text-slate-300">—</span>}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2 justify-end">
            {isRange ? (
              <Button variant="icon" size="compact" onClick={() => setExpanded(e => !e)}>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
            ) : (
              <>
                <Button variant="icon" size="compact" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="icon" size="compact" onClick={() => handleDelete(group.items[0].id, formatDateHebrew(group.items[0].date))}
                  disabled={deleting === group.items[0].id}
                  ><Trash2 className="w-3.5 h-3.5" /></Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {isRange && expanded && group.items.map(c => (
        <tr key={c.id} className="bg-slate-50/70 border-b border-slate-50">
          <td />
          <td className="px-4 py-2 text-xs text-slate-500 tabular-nums">↳ {formatDateHebrew(c.date)}</td>
          <td />
          <td className="px-4 py-2">
            <div className="flex justify-end">
              <Button variant="icon" size="compact" onClick={() => handleDelete(c.id, formatDateHebrew(c.date))}
                disabled={deleting === c.id}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Day detail panel (shown when a day is clicked)
// ---------------------------------------------------------------------------

function DayDetailPanel({ iso, list, colorFor, onClose }: {
  iso: string;
  list: Constraint[];
  colorFor: (name: string) => string;
  onClose: () => void;
}) {
  const label = formatDateHebrew(iso);
  const dayName = HEB_DAYS[new Date(iso).getDay()];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-400 font-medium">{dayName}</p>
            <h3 className="text-lg font-bold text-slate-800">{label}</h3>
          </div>
          <div className="flex items-center gap-3">
            {list.length > 0 && (
              <Badge className="bg-red-100 text-red-700 border-transparent">
                {list.length} נעדרים
              </Badge>
            )}
            <Button variant="ghost" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 text-lg leading-none">
              ×
            </Button>
          </div>
        </div>
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {list.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="mt-2 text-sm text-slate-500">אין הסתייגויות ביום זה</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {list.map(c => (
                <li key={c.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorFor(c.employee_name).replace("text-","bg-").split(" ")[0]}`} />
                    <span className="text-sm font-medium text-slate-800 truncate">{c.employee_name}</span>
                  </div>
                  {c.reason ? (
                    <Badge className="bg-purple-100 text-purple-700 border-transparent shrink-0">
                      {c.reason}
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-300 flex-shrink-0">ללא סיבה</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
          <Button variant="secondary" onClick={onClose} className="w-full">סגור</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar view
// ---------------------------------------------------------------------------

function CalendarView({ constraints, filterName, setFilterName, filterReason, setFilterReason, filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo, totalCount }: {
  constraints: Constraint[];
  filterName: string; setFilterName: (v: string) => void;
  filterReason: string; setFilterReason: (v: string) => void;
  filterDateFrom: string; setFilterDateFrom: (v: string) => void;
  filterDateTo: string; setFilterDateTo: (v: string) => void;
  totalCount: number;
}) {
  const now = new Date();
  const [calYear,    setCalYear]    = useState(now.getFullYear());
  const [calMonth,   setCalMonth]   = useState(now.getMonth() + 1);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const totalDays = daysInMonth(calYear, calMonth);
  const startDay  = firstDayOfWeek(calYear, calMonth);

  const byDate: Record<string, Constraint[]> = {};
  const prefix = `${calYear.toString().padStart(4,"0")}-${calMonth.toString().padStart(2,"0")}-`;
  for (const c of constraints) {
    if (c.date.startsWith(prefix)) {
      if (!byDate[c.date]) byDate[c.date] = [];
      byDate[c.date].push(c);
    }
  }

  const prevMonth = () => { setSelectedIso(null); if (calMonth===1){setCalMonth(12);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); };
  const nextMonth = () => { setSelectedIso(null); if (calMonth===12){setCalMonth(1);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); };

  const cells: (number|null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({length: totalDays}, (_,i)=>i+1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (day: number) => {
    const t = new Date();
    return t.getFullYear()===calYear && t.getMonth()+1===calMonth && t.getDate()===day;
  };

  const isoFor = (day: number) =>
    `${calYear.toString().padStart(4,"0")}-${calMonth.toString().padStart(2,"0")}-${day.toString().padStart(2,"0")}`;

  const empColors: Record<string,string> = {};
  const palette = [
    "bg-red-100 text-red-700","bg-orange-100 text-orange-700",
    "bg-amber-100 text-amber-700","bg-purple-100 text-purple-700",
    "bg-pink-100 text-pink-700","bg-indigo-100 text-indigo-700",
    "bg-teal-100 text-teal-700","bg-cyan-100 text-cyan-700",
  ];
  let colorIdx = 0;
  const colorFor = (name: string) => {
    if (!empColors[name]) empColors[name] = palette[colorIdx++ % palette.length];
    return empColors[name];
  };
  const allNames = [...new Set(constraints.map(c=>c.employee_name))].sort();
  allNames.forEach(n => colorFor(n));

  const hasFilter = filterName || filterReason || filterDateFrom || filterDateTo;
  const clearFilters = () => { setFilterName(""); setFilterReason(""); setFilterDateFrom(""); setFilterDateTo(""); };

  return (
    <div dir="rtl" className="space-y-4">
      {/* Day detail modal */}
      {selectedIso && (
        <DayDetailPanel
          iso={selectedIso}
          list={byDate[selectedIso] ?? []}
          colorFor={colorFor}
          onClose={() => setSelectedIso(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={nextMonth} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></Button>
        <h2 className="text-lg font-bold text-slate-800">{HEB_MONTHS[calMonth-1]} {calYear}</h2>
        <Button variant="ghost" onClick={prevMonth} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-5 h-5" /></Button>
      </div>

      <p className="text-xs text-slate-400 text-center">לחץ על יום לפרטים</p>

      <div className="grid grid-cols-7 gap-1">
        {HEB_DAYS.map(d => (
          <div key={d} className={`text-center text-xs font-semibold py-1.5 rounded ${d==="שבת"?"text-purple-500":"text-slate-500"}`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`blank-${idx}`} />;
          const iso    = isoFor(day);
          const list   = byDate[iso] ?? [];
          const isSat  = (startDay + day - 1) % 7 === 6;
          const today  = isToday(day);
          const selected = selectedIso === iso;

          return (
            <button
              key={iso}
              onClick={() => setSelectedIso(iso)}
              className={`min-h-[80px] rounded-xl border p-1.5 flex flex-col gap-1 text-right w-full transition-all
                ${selected   ? "border-blue-500 ring-2 ring-blue-300 bg-blue-50"
                : today      ? "border-blue-400 bg-blue-50 hover:border-blue-500"
                : list.length > 0 ? "border-red-200 bg-red-50 hover:border-red-400 hover:shadow-sm cursor-pointer"
                : isSat      ? "border-purple-100 bg-purple-50/40 hover:bg-purple-50"
                :              "border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-300"}`}>
              <span className={`text-xs font-bold self-end leading-none px-1
                ${today?"text-blue-600":isSat?"text-purple-400":"text-slate-500"}`}>
                {day}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {list.slice(0,3).map(c => (
                  <span key={c.id} className={`text-[10px] leading-tight rounded px-1 py-0.5 truncate ${colorFor(c.employee_name)}`}>
                    {c.employee_name}
                  </span>
                ))}
                {list.length > 3 && (
                  <span className="text-[10px] text-slate-400 px-1">+{list.length-3} עוד</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {allNames.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-slate-500 mb-2">מקרא עובדים:</p>
          <div className="flex flex-wrap gap-2">
            {allNames.map(name => (
              <span key={name} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorFor(name)}`}>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ConstraintsPage() {
  const [activeTab,       setActiveTab]       = useState<"table"|"calendar">("table");
  const [filterName,      setFilterName]      = useState("");
  const [filterReason,    setFilterReason]    = useState("");
  const [filterDateFrom,  setFilterDateFrom]  = useState("");
  const [filterDateTo,    setFilterDateTo]    = useState("");
  const [notice,          setNotice]          = useState<{type:"success"|"error";msg:string}|null>(null);
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFormatPopup, setShowFormatPopup] = useState(false);

  const { constraints, loading, error, add, update, remove, clear, importCsv } = useConstraints();
  const { employees } = useEmployees();
  const employeeNames = employees.map(e => e.name);

  const filtered = constraints.filter(c => {
    if (filterName && !c.employee_name.includes(filterName)) return false;
    if (filterReason && !(c.reason ?? "").includes(filterReason)) return false;
    if (filterDateFrom && c.date < filterDateFrom) return false;
    if (filterDateTo && c.date > filterDateTo) return false;
    return true;
  });
  const grouped = groupConstraints(filtered);

  const handleAdd = async (data: CreateConstraintPayload) => {
    const result = await add(data) as unknown as { created: Constraint[]; skipped: number };
    const count = result.created?.length ?? 1;
    setNotice({ type:"success", msg:`נוספו ${count} הסתייגויות עבור ${data.employee_name}${result.skipped ? ` (${result.skipped} כפולים דולגו)` : ""}` });
    setShowAddModal(false);
  };

  const handleImport = async (file: File, mode: "replace"|"append") => {
    const result = await importCsv(file, mode);
    setNotice({ type:"success", msg:`יובאו ${result.imported} הסתייגויות${result.skipped ? ` (${result.skipped} כפולים דולגו)` : ""}` });
    setShowImportModal(false);
  };

  const handleClearAll = async () => {
    if (!confirm("למחוק את כל ההסתייגויות? פעולה זו אינה הפיכה.")) return;
    try { await clear(); setNotice({ type:"success", msg:"כל ההסתייגויות נמחקו" }); }
    catch (e) { setNotice({ type:"error", msg:(e as Error).message }); }
  };

  const tabs = [
    { id:"table",    label: <span className="inline-flex items-center gap-1.5"><List className="w-3.5 h-3.5" />רשימה</span> },
    { id:"calendar", label: <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />לוח שנה</span> },
  ] as const;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Modals */}
      {showAddModal    && <AddModal    onSubmit={handleAdd}    onClose={() => setShowAddModal(false)}    employeeNames={employeeNames} />}
      {showImportModal && <ImportModal onImport={handleImport} onClose={() => setShowImportModal(false)} />}
      {showFormatPopup && <FormatPopup onClose={() => setShowFormatPopup(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">הסתייגויות</h1>
          <p className="text-slate-500 mt-1 text-sm">ניהול הסתייגויות עובדים ממשמרות — ייבוא מקובץ, הוספה ידנית, או תצוגת לוח שנה</p>
        </div>
        {constraints.length > 0 && (
          <Button variant="danger" onClick={handleClearAll} icon={<Trash2 className="w-4 h-4" />}>מחק הכל</Button>
        )}
      </div>

      {notice && <Alert type={notice.type} onClose={()=>setNotice(null)}>{notice.msg}</Alert>}

      {/* Action buttons above tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={() => setShowAddModal(true)} icon={<Plus className="w-4 h-4" />}>
          הוספה ידנית
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="secondary" onClick={() => setShowImportModal(true)} icon={<FolderOpen className="w-4 h-4" />}>
            ייבוא מקובץ
          </Button>
          <button
            onClick={() => setShowFormatPopup(true)}
            title="פורמט קובץ נדרש"
            className="w-7 h-7 rounded-full border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 text-xs font-bold flex items-center justify-center transition-colors"
          >
            ?
          </button>
        </div>
      </div>

      {/* Tabs */}
      <TabsContainer>
        {tabs.map(tab => (
          <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className="px-4 py-2">
            {tab.label}
            {tab.id === "table" && (
              <span suppressHydrationWarning>
                ({constraints.length})
              </span>
            )}
          </TabButton>
        ))}
      </TabsContainer>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* CALENDAR */}
        {activeTab==="calendar" && (
          <div className="p-4">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">טוען...</div>
            ) : (
              <CalendarView
                constraints={filtered}
                filterName={filterName} setFilterName={setFilterName}
                filterReason={filterReason} setFilterReason={setFilterReason}
                filterDateFrom={filterDateFrom} setFilterDateFrom={setFilterDateFrom}
                filterDateTo={filterDateTo} setFilterDateTo={setFilterDateTo}
                totalCount={constraints.length}
              />
            )}
          </div>
        )}

        {/* TABLE */}
        {activeTab==="table" && (
          <>
            {error && <div className="p-6"><Alert type="error">{error}</Alert></div>}

            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">טוען...</div>
            ) : grouped.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <p className="text-slate-400 text-sm">{constraints.length === 0 ? "אין הסתייגויות עדיין" : "לא נמצאו תוצאות"}</p>
                {constraints.length === 0 && (
                  <div className="flex gap-3 justify-center mt-3">
                    <Button onClick={() => setShowAddModal(true)} className="px-3 py-1.5 text-sm">הוסף ידנית</Button>
                    <Button variant="secondary" onClick={() => setShowImportModal(true)} className="px-3 py-1.5 text-sm">ייבוא מקובץ</Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">שם עובד</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">תאריך</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">סיבה</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map((g, i) => (
                      <GroupedRow key={i} group={g} onDelete={remove} onUpdate={update} employeeNames={employeeNames} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
