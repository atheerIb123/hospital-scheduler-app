import { useState } from "react";
import { DayType } from "@/lib/types";

const COLOR_OPTIONS = [
  "bg-slate-100 text-slate-700 border-slate-200",
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-purple-100 text-purple-800 border-purple-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
];

interface Props {
  dayTypes: DayType[];
  loading: boolean;
  createDayType: (name: string, color: string) => Promise<any>;
  deleteDayType: (id: string) => Promise<any>;
  updateDayType: (id: string, data: { name?: string; color?: string }) => Promise<any>;
}

export default function DayTypeManager({ dayTypes, loading, createDayType, deleteDayType, updateDayType }: Props) {
  const [newTypeName, setNewTypeName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [adding, setAdding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAdd = async () => {
    if (!newTypeName.trim()) return;
    setAdding(true);
    try {
      await createDayType(newTypeName, selectedColor);
      setNewTypeName("");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="text-right">
            <h2 className="font-semibold text-slate-800">מבני יום (Day Structures)</h2>
            <p className="text-xs text-slate-400">נהל חגים וימים מיוחדים</p>
          </div>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isExpanded && (
        <div className="p-6 border-t border-slate-100 space-y-6 animate-in slide-in-from-top-2 duration-200">
          {/* Add New */}
          <div className="flex flex-col sm:flex-row gap-4 items-end bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <div className="flex-1 space-y-1.5 w-full">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">שם הסוג</label>
              <input
                dir="rtl"
                type="text"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="לדוגמה: חג, ערב חג"
                className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-sm font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">צבע</label>
              <div className="flex gap-1.5 p-1.5 bg-white rounded-xl border border-slate-200">
                {COLOR_OPTIONS.slice(0, 5).map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`w-5 h-5 rounded-full border transition-all ${c} ${selectedColor === c ? "ring-2 ring-blue-400 scale-110" : "opacity-40 hover:opacity-100"
                      }`}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || !newTypeName.trim()}
              className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-sm active:scale-95 transition-all w-full sm:w-auto"
            >
              {adding ? "מוסיף..." : "הוסף"}
            </button>
          </div>

          {/* List */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">סוגים קיימים</p>
            {loading ? (
              <div className="h-10 w-full bg-slate-50 animate-pulse rounded-xl" />
            ) : dayTypes.length === 0 ? (
              <p className="text-xs text-slate-400 italic">טרם הוגדרו סוגי ימים</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {dayTypes.map((dt) => (
                  <div key={dt.id} className="group flex items-center gap-2 bg-white border border-slate-100 p-2 rounded-xl hover:border-slate-200 transition-all">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${dt.color.split(" ")[0]}`} />
                    <input
                      dir="rtl"
                      defaultValue={dt.name}
                      onBlur={(e) => e.target.value !== dt.name && updateDayType(dt.id, { name: e.target.value })}
                      className="flex-1 text-xs font-semibold text-slate-700 bg-transparent border-none focus:ring-0 p-0"
                    />
                    <button
                      onClick={() => deleteDayType(dt.id)}
                      className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
