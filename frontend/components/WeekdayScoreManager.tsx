"use client";
import { useState, useEffect } from "react";
import { getWeekdayScores, setWeekdayScores } from "@/lib/api";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui";
import { Calendar, X, Check } from "lucide-react";

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
  const [open, setOpen] = useState(false);
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
      setTimeout(() => { setSaved(false); setOpen(false); }, 1000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} icon={<Calendar className="w-4 h-4" />}>
        ניקוד ימי שבוע
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">ניקוד ימי שבוע</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-xs text-slate-500">
                ציוני <span className="text-purple-600 font-semibold">שישי ושבת</span> יחושבו גם בטבלת שבתות וחגים
              </p>
              <div className="flex flex-col gap-2">
                {WEEKDAYS.map(({ key, label, shabbat }) => (
                  <Input
                    key={key}
                    type="number"
                    min={0}
                    inputPrefix={label}
                    value={scores[key] ?? 0}
                    onChange={(e) => setScores(prev => ({ ...prev, [key]: Math.max(0, Number(e.target.value) || 0) }))}
                    className={shabbat ? "border-purple-200 focus:ring-purple-300" : ""}
                  />
                ))}
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className={`px-5 py-2 text-sm font-bold rounded-xl transition-all disabled:opacity-50 shadow-sm active:scale-95 ${
                    saved ? "bg-emerald-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {saving ? "שומר..." : saved ? <span className="inline-flex items-center gap-1">נשמר <Check className="w-4 h-4" /></span> : "שמור"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
