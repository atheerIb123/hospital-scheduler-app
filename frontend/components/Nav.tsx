"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Select, Button } from "./ui";
import { useMode } from "@/components/ModeProvider";
import { Activity, Plus, Trash2, Building2 } from "lucide-react";
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

const modeNames: Record<string, string> = {
  doctors: "רופאים",
  nursing: "סיעוד",
  cleaning: "ניקיון",
};

export default function Nav() {
  const pathname = usePathname();
  const { mode, setMode } = useMode();

  const [departments, setDepartments] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [base, ...depParts] = (mode || "doctors").split("_");
  const selectedDepartment = depParts.join("_");

  // nursing and doctors are unified — no department switching in Nav
  const showDeptSelector = base !== "nursing" && base !== "doctors";

  useEffect(() => {
    if (base !== "nursing" && !showDeptSelector) return;
    getDepartments()
      .then((data) => setDepartments(data ?? []))
      .catch(() => setDepartments([]));
  }, [showDeptSelector, base]);

  const department = selectedDepartment || departments[0] || "";

  return (
    <>
      <nav
        dir="rtl"
        className="fixed top-0 right-0 bottom-0 z-40 w-60 bg-white border-l border-slate-200 flex flex-col"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-slate-800 font-bold text-sm leading-tight">מתזמן משמרות</p>
            <p className="text-slate-400 text-xs leading-tight">Hospital Scheduler</p>
          </div>
        </div>

        {/* Nav Links */}
        <div className="flex-1 py-3 flex flex-col gap-0.5 px-3">
          {links.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-blue-50 text-blue-700 border border-blue-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Mode selector */}
        <div className="px-4 py-4 border-t border-slate-100 flex flex-col gap-3">
          {mode && (
            <p className="text-xs text-slate-400 font-medium px-1">{modeNames[base]}</p>
          )}

          <Select
            value={base}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "nursing") {
                setMode(departments[0] ? `nursing_${departments[0]}` : "nursing");
              } else {
                setMode(val);
              }
            }}
          >
            <option value="doctors">תצוגת רופאים</option>
            <option value="nursing">תצוגת סיעוד</option>
            <option value="cleaning">תצוגת ניקיון</option>
          </Select>

          {base === "nursing" && (
            <div className="flex flex-col gap-2">
              <Select
                value={department}
                onChange={(e) => setMode(e.target.value ? `nursing_${e.target.value}` : "nursing")}
              >
                {departments.length > 0 ? (
                  departments.map((dep) => (
                    <option key={dep} value={dep}>
                      {dep}
                    </option>
                  ))
                ) : (
                  <option value="">אין מחלקות</option>
                )}
              </Select>

              <div className="flex gap-2">
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  title="הוסף מחלקה חדשה"
                  icon={<Plus className="w-4 h-4" />}
                >
                  הוסף
                </Button>
                <Button
                  variant="danger"
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
                  disabled={!department || isSubmitting}
                  icon={<Trash2 className="w-4 h-4" />}
                >
                  מחק
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Add department modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 border border-emerald-200">
                <Building2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">הוספת מחלקה חדשה</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                שם המחלקה שתזין יתווסף לרשימה ותיפתח עבורו סביבת עבודה נפרדת במערכת.
              </p>
              <label className="block text-sm font-medium text-slate-700 mb-2">שם המחלקה</label>
              <input
                type="text"
                value={newDepartmentName}
                onChange={(e) => setNewDepartmentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDepartmentName.trim())
                    document.getElementById("add-dept-submit")?.click();
                }}
                placeholder="לדוגמה: אונקולוגיה"
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                autoFocus
              />
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100">
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    setIsSubmitting(true);
                    try {
                      const updated = await restoreDefaultDepartments();
                      setDepartments(updated);
                      if (!department && updated[0]) setMode(`${base}_${updated[0]}`);
                    } catch {
                      alert("שגיאה בשחזור מחלקות ברירת מחדל");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting}
                >
                  חזור לברירת מחדל
                </Button>
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => { setIsAddModalOpen(false); setNewDepartmentName(""); }}
                    disabled={isSubmitting}
                  >
                    ביטול
                  </Button>
                  <Button
                    id="add-dept-submit"
                    onClick={async () => {
                      const cleanName = newDepartmentName.trim();
                      if (!cleanName) return;
                      setIsSubmitting(true);
                      try {
                        const updated = await addDepartment(cleanName);
                        setDepartments(updated);
                        setIsAddModalOpen(false);
                        setNewDepartmentName("");
                        setTimeout(() => setMode(`${base}_${cleanName}`), 150);
                      } catch {
                        alert("שגיאה ביצירת מחלקה");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={!newDepartmentName.trim() || isSubmitting}
                  >
                    {isSubmitting ? "מוסיף..." : "הוסף מחלקה"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
