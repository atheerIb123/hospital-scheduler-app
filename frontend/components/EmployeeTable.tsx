"use client";
import { useRef, useState } from "react";
import { useEmployees } from "@/hooks/useEmployees";

const COL_TO_SHIFTS: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5], 2: [6], 3: [7], 4: [7, 8],
  5: [9], 6: [10], 7: [12], 8: [13],
};
const colAttr = (i: number) => `col_${i}`;

const COL_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
];

export default function EmployeeTable() {
  const { employees, columnHeaders, loading, error, importCsv, removeEmployee } = useEmployees();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) handleFile(file);
  };

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl shimmer" />)}
    </div>
  );
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{error}</div>
  );

  const cols = Array.from({ length: 8 }, (_, i) => i + 1);

  return (
    <div className="space-y-6 fade-in">
      {/* Upload */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
          dragging ? "border-blue-500 bg-blue-50 scale-[1.01]" : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
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
              {importing ? "מייבא נתונים…" : "גרור קובץ CSV לכאן"}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              או לחץ לבחירת קובץ · שורה 1 = כותרות · עמודה 1 = שם · עמודות 2–10 = V להרשאה
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
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {importError}
        </div>
      )}
      {importSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700 font-medium">
          {importSuccess}
        </div>
      )}

      {/* Table */}
      {employees.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">רשימת עובדים</h3>
            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
              {employees.length} עובדים
            </span>
          </div>
          <div className="overflow-x-auto sticky-header" style={{ maxHeight: "520px", overflowY: "auto" }}>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-right font-semibold text-slate-600 whitespace-nowrap sticky top-0 bg-slate-50">שם עובד</th>
                  {cols.map((i) => (
                    <th key={i} className="px-2 py-3 text-center sticky top-0 bg-slate-50 min-w-[90px]">
                      <div className={`inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium ${COL_COLORS[i - 1]}`}>
                        <span className="font-semibold">{columnHeaders[i - 1] ?? `עמודה ${i + 1}`}</span>
                        <span className="opacity-60 font-normal">{COL_TO_SHIFTS[i].join(",")}</span>
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 sticky top-0 bg-slate-50"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, idx) => (
                  <tr key={emp.id}
                    className={`border-b border-slate-50 transition-colors hover:bg-blue-50/40 ${idx % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                    <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">{emp.name}</td>
                    {cols.map((i) => (
                      <td key={i} className="px-2 py-3 text-center">
                        {emp.attributes.includes(colAttr(i)) ? (
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${COL_COLORS[i - 1]}`}>
                            ✓
                          </span>
                        ) : (
                          <span className="text-slate-200 text-base">·</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => removeEmployee(emp.id)}
                        className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all text-lg font-bold leading-none">
                        ×
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
          <p className="text-sm mt-1">ייבא קובץ CSV להתחלה</p>
        </div>
      )}
    </div>
  );
}
