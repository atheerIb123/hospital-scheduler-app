"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Activity } from "lucide-react";
import { Select } from "./ui";
import { useMode } from "@/components/ModeProvider";

const allLinks = [
  { href: "/employees",   label: "עובדים",          nursingOnly: false },
  { href: "/shift-types", label: "סוגי משמרות",     nursingOnly: false },
  { href: "/constraints", label: "הסתייגויות",      nursingOnly: false },
  { href: "/schedule",    label: "סידור עבודה",     nursingOnly: false },
  { href: "/oncall",      label: "כוננות סיעוד",    nursingOnly: true  },
  { href: "/justice",     label: "טבלאות ניקוד",    nursingOnly: false },
  { href: "/stats",       label: "סטטיסטיקות",      nursingOnly: false },
];

const modeNames: Record<string, string> = {
  doctors: "רופאים",
  nursing: "סיעוד",
  cleaning: "ניקיון",
};

export default function Nav() {
  const pathname = usePathname();
  const { mode, setMode } = useMode();

  const [base] = (mode || "doctors").split("_");
  const isNursing = base === "nursing";
  const links = allLinks.filter(l => !l.nursingOnly || isNursing);

  return (
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
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="doctors">תצוגת רופאים</option>
          <option value="nursing">תצוגת סיעוד</option>
          <option value="cleaning">תצוגת ניקיון</option>
        </Select>
      </div>
    </nav>
  );
}
