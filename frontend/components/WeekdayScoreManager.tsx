"use client";
import { useState, useEffect } from "react";
import { getWeekdayScores, setWeekdayScores } from "@/lib/api";

// Python weekday: 0=Mon,1=Tue,2=Wed,3=Thu,4=Fri,5=Sat,6=Sun
// Display in Israeli order: Sun first
const WEEKDAYS = [
  { key: "6", label: "ראשון", shabbat: false },
  { key: "0", label: "שני",   shabbat: false },
  { key: "1", label: "שלישי", shabbat: false },
  { key: "2", label: "רביעי", shabbat: false },
  { key: "3", label: "חמישי", shabbat: false },
  { key: "4", label: "שישי",  shabbat: true  },
  { key: "5", label: "שבת",   shabbat: true  },
];

const DEFAULT_SCORES: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 2, "5": 2, "6": 0 };

export default function WeekdayScoreManager() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>(DEFAULT_SCORES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getWeekdayScores().then(setScores).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setWeekdayScores(scores);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="text-right">
            <h2 className="font-semibold text-slate-800">ניקוד ימי שבוע</h2>
            <p className="text-xs text-slate-400">קבע ניקוד לכל יום בשבוע</p>
          </div>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {isExpanded && (
        <div className="p-6 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <p className="text-xs text-slate-500">
            ציוני <span className="text-purple-600 font-semibold">שישי ושבת</span> יחושבו גם בטבלת שבתות וחגים
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {WEEKDAYS.map(({ key, label, shabbat }) => (
              <div
                key={key}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border ${
                  shabbat ? "bg-purple-50 border-purple-200" : "bg-slate-50 border-slate-200"
                }`}
              >
                <span className={`text-xs font-semibold ${shabbat ? "text-purple-700" : "text-slate-700"}`}>
                  {label}
                  {shabbat && <span className="ml-0.5">🕍</span>}
                </span>
                <input
                  type="number"
                  min={0}
                  value={scores[key] ?? 0}
                  onChange={(e) => setScores(prev => ({ ...prev, [key]: Math.max(0, Number(e.target.value) || 0) }))}
                  className={`w-full text-center text-sm font-bold border rounded-lg px-1 py-1 focus:outline-none focus:ring-2 ${
                    shabbat
                      ? "border-purple-200 bg-white focus:ring-purple-300"
                      : "border-slate-200 bg-white focus:ring-blue-200"
                  }`}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className={`px-5 py-2 text-sm font-bold rounded-xl transition-all disabled:opacity-50 shadow-sm active:scale-95 ${
              saved ? "bg-emerald-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {saving ? "שומר..." : saved ? "נשמר ✓" : "שמור"}
          </button>
        </div>
      )}
    </div>
  );
}
