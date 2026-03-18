"use client";

import { useState, useRef } from "react";
import { useConstraints } from "@/hooks/useConstraints";
import type { Constraint, CreateConstraintPayload } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEB_DAYS  = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת"];
const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני",
                    "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function todayIso() { return new Date().toISOString().slice(0, 10); }

function formatDateHebrew(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate(); // month is 1-based
}

// Sunday = 0 in JS, but Israel week starts Sunday too so we use 0-based as-is
function firstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay(); // 0=Sun … 6=Sat
}

// ---------------------------------------------------------------------------
// Tiny shared UI
// ---------------------------------------------------------------------------

function Alert({ type, children, onClose }: {
  type: "success" | "error" | "warning";
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const s = { success: "bg-emerald-50 border-emerald-200 text-emerald-800",
              error:   "bg-red-50 border-red-200 text-red-800",
              warning: "bg-amber-50 border-amber-200 text-amber-800" };
  return (
    <div className={`flex items-start gap-3 border rounded-xl p-4 ${s[type]}`} dir="rtl">
      <span className="text-lg mt-0.5">{type==="success"?"✅":type==="error"?"❌":"⚠️"}</span>
      <div className="flex-1 text-sm">{children}</div>
      {onClose && <button onClick={onClose} className="opacity-60 hover:opacity-100 text-lg leading-none">×</button>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual add form — now accepts free-text date expression
// ---------------------------------------------------------------------------

function ConstraintForm({ initial, onSubmit, onCancel, submitLabel = "הוסף" }: {
  initial?: Partial<CreateConstraintPayload>;
  onSubmit: (data: CreateConstraintPayload) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [name,   setName]   = useState(initial?.employee_name ?? "");
  const [date,   setDate]   = useState(initial?.date ?? "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr("שם עובד הוא שדה חובה"); return; }
    if (!date.trim()) { setErr("תאריך הוא שדה חובה");   return; }
    setSaving(true); setErr(null);
    try {
      await onSubmit({ employee_name: name.trim(), date: date.trim(), reason: reason.trim() });
      if (!initial) { setName(""); setDate(""); setReason(""); }
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" dir="rtl">
      {err && <Alert type="error" onClose={() => setErr(null)}>{err}</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">שם עובד *</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder='ד"ר כהן'
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            תאריך / טווח *
            <span className="font-normal text-slate-400 mr-1">— תאריך בודד, טווח, או כמה בפסיק</span>
          </label>
          <input value={date} onChange={e=>setDate(e.target.value)}
            placeholder="01/10/2026 - 05/10/2026, 10/10/2026"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">סיבה (אופציונלי)</label>
          <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="חופשה, מחלה..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "שומר..." : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
            ביטול
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// CSV import panel
// ---------------------------------------------------------------------------

function CsvImportPanel({ onImport }: { onImport: (file: File, mode: "replace"|"append") => Promise<void> }) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [mode,     setMode]     = useState<"replace"|"append">("replace");
  const [status,   setStatus]   = useState<{type:"success"|"error";msg:string}|null>(null);
  const [importing,setImporting]= useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setStatus(null);
    try {
      await onImport(file, mode);
      setStatus({ type: "success", msg: "הקובץ יובא בהצלחה" });
    } catch (err) { setStatus({ type: "error", msg: (err as Error).message }); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700 mb-2">📋 פורמט קובץ CSV נדרש:</p>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead><tr className="bg-slate-200">
              <th className="border border-slate-300 px-3 py-1">שם עובד</th>
              <th className="border border-slate-300 px-3 py-1">תאריך</th>
              <th className="border border-slate-300 px-3 py-1">סיבה</th>
            </tr></thead>
            <tbody>
              <tr><td className="border border-slate-300 px-3 py-1">ד&quot;ר כהן</td>
                  <td className="border border-slate-300 px-3 py-1">05/06/2026</td>
                  <td className="border border-slate-300 px-3 py-1">חופשה</td></tr>
              <tr className="bg-slate-50">
                  <td className="border border-slate-300 px-3 py-1">ד&quot;ר לוי</td>
                  <td className="border border-slate-300 px-3 py-1">01/07/2026 - 05/07/2026</td>
                  <td className="border border-slate-300 px-3 py-1">חופשה</td></tr>
              <tr><td className="border border-slate-300 px-3 py-1">ד&quot;ר מזרחי</td>
                  <td className="border border-slate-300 px-3 py-1">10/07/2026, 15/07/2026 - 17/07/2026</td>
                  <td className="border border-slate-300 px-3 py-1"></td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">פורמטי תאריך: DD/MM/YYYY | YYYY-MM-DD | DD.MM.YYYY</p>
      </div>

      <div className="flex gap-4 items-center">
        <span className="text-sm font-medium text-slate-600">מצב ייבוא:</span>
        {(["replace","append"] as const).map(m => (
          <label key={m} className="flex items-center gap-1.5 cursor-pointer text-sm">
            <input type="radio" name="import-mode" checked={mode===m} onChange={()=>setMode(m)} className="accent-blue-600" />
            {m==="replace" ? "החלף הכל" : "הוסף לקיים"}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
          importing ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
          {importing ? "מייבא..." : "📂 בחר קובץ CSV"}
          <input ref={fileRef} type="file" accept=".csv" className="hidden" disabled={importing} onChange={handleFile} />
        </label>
        {mode==="replace" && <span className="text-xs text-amber-600 font-medium">⚠️ יחליף את כל ההסתייגויות הקיימות</span>}
      </div>

      {status && <Alert type={status.type} onClose={()=>setStatus(null)}>{status.msg}</Alert>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table row with inline edit
// ---------------------------------------------------------------------------

function ConstraintRow({ constraint, onUpdate, onDelete }: {
  constraint: Constraint;
  onUpdate: (id: string, data: Partial<CreateConstraintPayload>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
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
          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{constraint.reason}</span>
          : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2 justify-end">
          <button onClick={()=>setEditing(true)} className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">✏️ ערוך</button>
          <button onClick={handleDelete} disabled={deleting} className="px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">🗑️ מחק</button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Calendar view
// ---------------------------------------------------------------------------

function CalendarView({ constraints }: { constraints: Constraint[] }) {
  const now = new Date();
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1); // 1-based

  const totalDays  = daysInMonth(calYear, calMonth);
  const startDay   = firstDayOfWeek(calYear, calMonth); // 0=Sun

  // Build map: "YYYY-MM-DD" → Constraint[]
  const byDate: Record<string, Constraint[]> = {};
  const prefix = `${calYear.toString().padStart(4,"0")}-${calMonth.toString().padStart(2,"0")}-`;
  for (const c of constraints) {
    if (c.date.startsWith(prefix)) {
      if (!byDate[c.date]) byDate[c.date] = [];
      byDate[c.date].push(c);
    }
  }

  const prevMonth = () => { if (calMonth===1){setCalMonth(12);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); };
  const nextMonth = () => { if (calMonth===12){setCalMonth(1);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); };

  // Cells: leading blanks + day cells
  const cells: (number|null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({length: totalDays}, (_,i)=>i+1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (day: number) => {
    const t = new Date();
    return t.getFullYear()===calYear && t.getMonth()+1===calMonth && t.getDate()===day;
  };

  const isoFor = (day: number) =>
    `${calYear.toString().padStart(4,"0")}-${calMonth.toString().padStart(2,"0")}-${day.toString().padStart(2,"0")}`;

  // Colour palette cycling for employee names
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
  // Pre-assign colours in sorted order for consistency
  const allNames = [...new Set(constraints.map(c=>c.employee_name))].sort();
  allNames.forEach(n => colorFor(n));

  return (
    <div dir="rtl" className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600">→</button>
        <h2 className="text-lg font-bold text-slate-800">{HEB_MONTHS[calMonth-1]} {calYear}</h2>
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600">←</button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1">
        {HEB_DAYS.map(d => (
          <div key={d} className={`text-center text-xs font-semibold py-1.5 rounded ${d==="שבת"?"text-purple-500":"text-slate-500"}`}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`blank-${idx}`} />;
          const iso  = isoFor(day);
          const list = byDate[iso] ?? [];
          const isSat = (startDay + day - 1) % 7 === 6;
          const today = isToday(day);

          return (
            <div key={iso}
              className={`min-h-[80px] rounded-xl border p-1.5 flex flex-col gap-1 text-right transition-colors
                ${today  ? "border-blue-400 bg-blue-50"
                : list.length > 0 ? "border-red-200 bg-red-50"
                : isSat  ? "border-purple-100 bg-purple-50/40"
                :          "border-slate-100 bg-white hover:bg-slate-50"}`}>

              {/* Day number */}
              <span className={`text-xs font-bold self-end leading-none px-1
                ${today?"text-blue-600":isSat?"text-purple-400":"text-slate-500"}`}>
                {day}
              </span>

              {/* Absent employees */}
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {list.slice(0,3).map(c => (
                  <span key={c.id} className={`text-[10px] leading-tight rounded px-1 py-0.5 truncate ${colorFor(c.employee_name)}`}
                    title={c.reason ? `${c.employee_name} — ${c.reason}` : c.employee_name}>
                    {c.employee_name}
                  </span>
                ))}
                {list.length > 3 && (
                  <span className="text-[10px] text-slate-400 px-1">+{list.length-3} עוד</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
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
  const [activeTab, setActiveTab] = useState<"table"|"calendar"|"import"|"add">("table");
  const [filterName, setFilterName] = useState("");
  const [notice, setNotice] = useState<{type:"success"|"error";msg:string}|null>(null);

  const { constraints, loading, error, add, update, remove, clear, importCsv } = useConstraints();

  const filtered = constraints.filter(c => filterName ? c.employee_name.includes(filterName) : true);

  const handleAdd = async (data: CreateConstraintPayload) => {
    const result = await add(data) as unknown as { created: Constraint[]; skipped: number };
    const count = result.created?.length ?? 1;
    setNotice({ type:"success", msg:`נוספו ${count} הסתייגויות עבור ${data.employee_name}${result.skipped ? ` (${result.skipped} כפולים דולגו)` : ""}` });
    setActiveTab("table");
  };

  const handleImport = async (file: File, mode: "replace"|"append") => {
    const result = await importCsv(file, mode);
    setNotice({ type:"success", msg:`יובאו ${result.imported} הסתייגויות${result.skipped ? ` (${result.skipped} כפולים דולגו)` : ""}` });
    setActiveTab("table");
  };

  const handleClearAll = async () => {
    if (!confirm("למחוק את כל ההסתייגויות? פעולה זו אינה הפיכה.")) return;
    try { await clear(); setNotice({ type:"success", msg:"כל ההסתייגויות נמחקו" }); }
    catch (e) { setNotice({ type:"error", msg:(e as Error).message }); }
  };

  const tabs = [
    { id:"table",    label:`📋 רשימה (${constraints.length})` },
    { id:"calendar", label:"📅 לוח שנה" },
    { id:"add",      label:"➕ הוסף ידנית" },
    { id:"import",   label:"📂 ייבוא מקובץ" },
  ] as const;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">הסתייגויות</h1>
          <p className="text-slate-500 mt-1 text-sm">ניהול הסתייגויות עובדים ממשמרות — ייבוא מקובץ, הוספה ידנית, או תצוגת לוח שנה</p>
        </div>
        {constraints.length > 0 && (
          <button onClick={handleClearAll}
            className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
            🗑️ מחק הכל
          </button>
        )}
      </div>

      {notice && <Alert type={notice.type} onClose={()=>setNotice(null)}>{notice.msg}</Alert>}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 -mb-px">
          {tabs.map(tab => (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab===tab.id
                  ? "border-blue-600 text-blue-700 bg-blue-50"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* ADD */}
        {activeTab==="add" && (
          <div className="p-6">
            <h2 className="text-base font-semibold text-slate-700 mb-1">הוספת הסתייגות ידנית</h2>
            <p className="text-xs text-slate-400 mb-4">ניתן להזין תאריך בודד, טווח תאריכים, או שילוב מופרד בפסיק</p>
            <ConstraintForm onSubmit={handleAdd} />
          </div>
        )}

        {/* IMPORT */}
        {activeTab==="import" && (
          <div className="p-6">
            <h2 className="text-base font-semibold text-slate-700 mb-4">ייבוא הסתייגויות מקובץ CSV</h2>
            <CsvImportPanel onImport={handleImport} />
          </div>
        )}

        {/* CALENDAR */}
        {activeTab==="calendar" && (
          <div className="p-4">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">טוען...</div>
            ) : (
              <CalendarView constraints={constraints} />
            )}
          </div>
        )}

        {/* TABLE */}
        {activeTab==="table" && (
          <>
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
              <span className="text-sm text-slate-500">סינון:</span>
              <input value={filterName} onChange={e=>setFilterName(e.target.value)}
                placeholder="חיפוש לפי שם עובד..."
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {filterName && <button onClick={()=>setFilterName("")} className="text-xs text-slate-400 hover:text-slate-600">✕ נקה</button>}
              <span className="text-xs text-slate-400 mr-auto">מציג {filtered.length} מתוך {constraints.length}</span>
            </div>

            {error && <div className="p-6"><Alert type="error">{error}</Alert></div>}

            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">טוען...</div>
            ) : filtered.length===0 ? (
              <div className="py-16 text-center space-y-2">
                <p className="text-slate-400 text-sm">{constraints.length===0 ? "אין הסתייגויות עדיין" : "לא נמצאו תוצאות"}</p>
                {constraints.length===0 && (
                  <div className="flex gap-3 justify-center mt-3">
                    <button onClick={()=>setActiveTab("add")} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">הוסף ידנית</button>
                    <button onClick={()=>setActiveTab("import")} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200">ייבוא מקובץ</button>
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
                    {filtered.map(c => (
                      <ConstraintRow key={c.id} constraint={c} onUpdate={update} onDelete={remove} />
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
