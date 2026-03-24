"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMode } from "@/components/ModeProvider";
import {
  addDepartment,
  deleteDepartment,
  getDepartments,
  restoreDefaultDepartments,
} from "@/lib/api";

const links = [
  { href: "/employees", label: "עובדים" },
  { href: "/shift-types", label: "סוגי משמרות" },
  { href: "/constraints", label: "הסתייגויות" },
  { href: "/schedule", label: "סידור עבודה" },
  { href: "/justice", label: "טבלאות ניקוד" },
  { href: "/stats", label: "סטטיסטיקות" },
];

export default function Nav() {
  const pathname = usePathname();
  const { mode, setMode } = useMode();

  const [departments, setDepartments] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getDepartments()
      .then((data) => {
        setDepartments(data ?? []);
      })
      .catch(() => {
        setDepartments([]);
      });
  }, []);

  const [base, ...depParts] = (mode || "doctors").split("_");
  const selectedDepartment = depParts.join("_");
  const department = selectedDepartment || departments[0] || "";

  const modeNames: Record<string, string> = {
    doctors: "רופאים",
    nursing: department ? `סיעוד - ${department}` : "סיעוד",
    cleaning: "ניקיון",
  };

  return (
    <>
      <nav
        className="sticky top-0 z-40 border-b border-blue-800/30"
        style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)" }}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight tracking-wide">
                מתזמן משמרות {mode ? `- ${modeNames[base]}` : ""}
              </p>
              <p className="text-blue-200 text-xs leading-tight">Hospital Scheduler</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {links.map(({ href, label }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      active ? "bg-white text-blue-700 shadow-md" : "text-blue-100 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative border-r border-white/20 pr-4">
                <select
                  value={base}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "nursing") {
                      setMode(departments[0] ? `nursing_${departments[0]}` : "nursing");
                    } else {
                      setMode(val);
                    }
                  }}
                  className="appearance-none bg-white/10 text-white border border-white/20 pl-4 py-1.5 pr-8 rounded-lg outline-none focus:border-white/40 focus:bg-white/20 hover:bg-white/20 transition-all font-semibold text-sm cursor-pointer"
                >
                  <option value="doctors" className="text-slate-800">
                    תצוגת רופאים
                  </option>
                  <option value="nursing" className="text-slate-800">
                    תצוגת סיעוד
                  </option>
                  <option value="cleaning" className="text-slate-800">
                    תצוגת ניקיון
                  </option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center pr-2 text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {base === "nursing" && (
                <div className="relative flex items-center gap-2">
                  <div className="relative">
                    <select
                      value={department}
                      onChange={(e) => setMode(e.target.value ? `nursing_${e.target.value}` : "nursing")}
                      className="appearance-none bg-emerald-500/20 text-emerald-50 border border-emerald-400/30 pl-4 py-1.5 pr-8 rounded-lg outline-none focus:border-emerald-400/50 hover:bg-emerald-500/30 transition-all font-semibold text-sm cursor-pointer"
                    >
                      {departments.length > 0 ? (
                        departments.map((dep) => (
                          <option key={dep} value={dep} className="text-slate-800">
                            {dep}
                          </option>
                        ))
                      ) : (
                        <option value="" className="text-slate-800">
                          אין מחלקות
                        </option>
                      )}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-emerald-100">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    title="הוסף מחלקה חדשה"
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-200 hover:text-white hover:bg-emerald-500/40 border border-emerald-400/30 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={async () => {
                      if (!department) return;

                      const confirmed = window.confirm(`למחוק את המחלקה "${department}"?`);
                      if (!confirmed) return;

                      setIsSubmitting(true);
                      try {
                        const updated = await deleteDepartment(department);
                        setDepartments(updated);

                        if (updated[0]) {
                          setMode(`nursing_${updated[0]}`);
                        } else {
                          setMode("nursing");
                        }
                      } catch {
                        alert("שגיאה במחיקת מחלקה");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    title="מחק מחלקה"
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/15 text-red-200 border border-red-300/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:text-white enabled:hover:bg-red-500/35"
                    disabled={!department || isSubmitting}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {isAddModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 border border-emerald-200">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">הוספת מחלקה חדשה</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                שם המחלקה שתזין יתווסף לרשימה ותיפתח עבורו סביבת עבודה נפרדת ועצמאית במערכת.
              </p>

              <label className="block text-sm font-medium text-slate-700 mb-2">שם המחלקה</label>
              <input
                type="text"
                value={newDepartmentName}
                onChange={(e) => setNewDepartmentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDepartmentName.trim()) {
                    document.getElementById("add-department-submit")?.click();
                  }
                }}
                placeholder="לדוגמה: אונקולוגיה"
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                autoFocus
              />
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={async () => {
                    setIsSubmitting(true);
                    try {
                      const updated = await restoreDefaultDepartments();
                      setDepartments(updated);
                      if (base === "nursing" && !department && updated[0]) {
                        setMode(`nursing_${updated[0]}`);
                      }
                    } catch {
                      alert("שגיאה בשחזור מחלקות ברירת מחדל");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="px-4 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  חזור לברירת מחדל
                </button>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setNewDepartmentName("");
                    }}
                    className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    disabled={isSubmitting}
                  >
                    ביטול
                  </button>
                  <button
                    id="add-department-submit"
                    onClick={async () => {
                      const cleanName = newDepartmentName.trim();
                      if (!cleanName) return;

                      setIsSubmitting(true);
                      try {
                        const updated = await addDepartment(cleanName);
                        setDepartments(updated);
                        setIsAddModalOpen(false);
                        setNewDepartmentName("");
                        setTimeout(() => setMode(`nursing_${cleanName}`), 150);
                      } catch {
                        alert("שגיאה ביצירת מחלקה");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95"
                    disabled={!newDepartmentName.trim() || isSubmitting}
                  >
                    {isSubmitting ? "מוסיף..." : "הוסף מחלקה"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
