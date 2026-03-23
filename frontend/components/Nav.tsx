"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMode } from "@/components/ModeProvider";

const links = [
  { href: "/employees",   label: "עובדים" },
  { href: "/shift-types", label: "סוגי משמרות" },
  { href: "/constraints", label: "הסתייגויות" },
  { href: "/schedule",    label: "סידור עבודה" },
  { href: "/justice",     label: "טבלאות ניקוד" },
  { href: "/stats",       label: "סטטיסטיקות" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, setMode } = useMode();

  const modeNames = {
    doctors: "רופאים",
    nursing: "סיעוד",
    cleaning: "ניקיון",
  };

  if (!mode && pathname === "/") {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-blue-800/30"
      style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)" }}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight tracking-wide">
              מתזמן משמרות {mode ? `- ${modeNames[mode]}` : ""}
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
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-white text-blue-700 shadow-md"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  }`}>
                  {label}
                </Link>
              );
            })}
          </div>
          {mode && (
            <button
              onClick={() => {
                setMode(null);
                router.push("/");
              }}
              className="text-xs bg-white/10 text-white border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/20 hover:border-white/40 transition-colors font-semibold"
            >
              החלף תצוגה
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
