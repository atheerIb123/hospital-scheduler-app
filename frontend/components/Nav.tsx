"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMode } from "@/components/ModeProvider";
import { getDepartments, addDepartment } from "@/lib/api";

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
  const router = useRouter();
  const { mode, setMode } = useMode();
  
  const [departments, setDepartments] = useState<string[]>(["הדס", "דובדבן", "שקד", "אלון", "שיטה", "גבים", "ברוש", "ארז", "דולב", "גריאטריה", "בית", "אדר", "שקמה", "תשושי נפש"]);

  useEffect(() => {
    getDepartments().then((data) => {
      if (data && data.length > 0) {
        setDepartments(data);
      }
    }).catch(() => {});
  }, []);

  const [base, ...depParts] = (mode || "doctors").split("_");
  const department = depParts.join("_") || departments[0] || "הדס";

  const modeNames: Record<string, string> = {
    doctors: "רופאים",
    nursing: `סיעוד - ${department}`,
    cleaning: "ניקיון",
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-blue-800/30"
      style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)" }}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
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

        {/* Links */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            {links.map(({ href, label }) => {
              const active = pathname.startsWith(href);
              return (
                <Link key={href} href={href}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${active
                      ? "bg-white text-blue-700 shadow-md"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                    }`}>
                  {label}
                </Link>
              );
            })}
          </div>
          {/* Mode Selector */}
          <div className="flex items-center gap-3">
            <div className="relative border-r border-white/20 pr-4">
              <select
                value={base}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "nursing") {
                    setMode(`nursing_${departments[0]}`); // Default department
                  } else {
                    setMode(val);
                  }
                }}
                className="appearance-none bg-white/10 text-white border border-white/20 pl-4 py-1.5 pr-8 rounded-lg outline-none focus:border-white/40 focus:bg-white/20 hover:bg-white/20 transition-all font-semibold text-sm cursor-pointer"
              >
                <option value="doctors" className="text-slate-800">תצוגת רופאים</option>
                <option value="nursing" className="text-slate-800">תצוגת סיעוד</option>
                <option value="cleaning" className="text-slate-800">תצוגת ניקיון</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center pr-2 text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>

            {base === "nursing" && (
              <div className="relative">
                <select
                  value={department}
                  onChange={(e) => setMode(`nursing_${e.target.value}`)}
                  className="appearance-none bg-emerald-500/20 text-emerald-50 border border-emerald-400/30 pl-4 py-1.5 pr-8 rounded-lg outline-none focus:border-emerald-400/50 hover:bg-emerald-500/30 transition-all font-semibold text-sm cursor-pointer"
                >
                  {departments.map((dep) => (
                    <option key={dep} value={dep} className="text-slate-800">{dep}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-emerald-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
