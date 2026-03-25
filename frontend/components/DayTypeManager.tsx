import { useState, useEffect, useRef } from "react";
import { DayType } from "@/lib/types";
import { Button, Input, DeleteIconButton } from "@/components/ui";
import { DAY_TYPE_COLORS } from "@/lib/colors";
import { Calendar, X, Check, Loader2 } from "lucide-react";

function ScoreCell({ value, onSave }: { value: number; onSave: (v: number) => Promise<void> }) {
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = async () => {
    const v = Math.max(0, Number(draft) || 0);
    setDraft(String(v));
    if (v === value) return;
    setSaving(true);
    try {
      await onSave(v);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex items-center">
      <input
        ref={ref}
        type="number"
        min={0}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setSaved(false); }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") ref.current?.blur(); }}
        disabled={saving}
        className={`w-14 text-center text-xs font-semibold border rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300 transition-all ${
          saved ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-600"
        } disabled:opacity-50`}
        title="ציון"
      />
      {saving && (
        <Loader2 className="absolute -left-4 w-3 h-3 animate-spin text-blue-400" />
      )}
    </div>
  );
}

interface Props {
  dayTypes: DayType[];
  loading: boolean;
  createDayType: (name: string, color: string, score?: number) => Promise<any>;
  deleteDayType: (id: string) => Promise<any>;
  updateDayType: (id: string, data: { name?: string; color?: string; score?: number }) => Promise<any>;
}

export default function DayTypeManager({ dayTypes, loading, createDayType, deleteDayType, updateDayType }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [selectedColor, setSelectedColor] = useState(DAY_TYPE_COLORS[0].value);
  const [newScore, setNewScore] = useState(0);
  const [adding, setAdding] = useState(false);

  const resetForm = () => {
    setNewTypeName("");
    setSelectedColor(DAY_TYPE_COLORS[0].value);
    setNewScore(0);
  };

  const handleAdd = async () => {
    if (!newTypeName.trim()) return;
    setAdding(true);
    try {
      await createDayType(newTypeName, selectedColor, newScore);
      resetForm();
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setShowModal(true)}
        icon={<Calendar className="w-4 h-4" />}
      >
        הגדרות ימים
      </Button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { resetForm(); setShowModal(false); }} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-slate-800">הגדרות ימים</h2>
              <button
                type="button"
                onClick={() => { resetForm(); setShowModal(false); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* Add new day type form */}
              <div className="p-6 space-y-4 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">הוסף מבנה יום</p>
                <div className="space-y-1.5">
                  <Input
                    inputPrefix="שם הסוג: "
                    type="text"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="חג, ערב חג, וכו'"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                    className="max-w-82"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">צבע</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAY_TYPE_COLORS.map(({ value, swatch }) => {
                      const selected = selectedColor === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSelectedColor(value)}
                          className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${swatch} ${selected ? "border-slate-800 scale-110 shadow-md" : "border-transparent hover:scale-105 hover:border-slate-400"}`}
                        >
                          {selected && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Input
                    inputPrefix="ציון: "
                    type="number"
                    min={0}
                    value={newScore}
                    onChange={(e) => setNewScore(Math.max(0, Number(e.target.value)))}
                  />
                </div>

                <Button onClick={handleAdd} disabled={adding || !newTypeName.trim()}>
                  {adding ? "מוסיף..." : "הוסף"}
                </Button>
              </div>

              {/* Existing day types list */}
              <div className="p-6 space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">סוגים קיימים</p>
                {loading ? (
                  <div className="h-10 w-full bg-slate-50 animate-pulse rounded-xl" />
                ) : dayTypes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">טרם הוגדרו סוגי ימים</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dayTypes.map((dt) => (
                      <div key={dt.id} className="group flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl hover:border-slate-200 transition-all">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${DAY_TYPE_COLORS.find(c => c.value === dt.color)?.swatch ?? "bg-slate-400"}`} />
                        <input
                          dir="rtl"
                          defaultValue={dt.name}
                          onBlur={(e) => e.target.value !== dt.name && updateDayType(dt.id, { name: e.target.value })}
                          className="flex-1 text-xs font-semibold text-slate-700 bg-transparent border-none focus:ring-0 p-0 min-w-0"
                        />
                        <ScoreCell
                          value={dt.score ?? 0}
                          onSave={(v) => updateDayType(dt.id, { score: v })}
                        />
                        <DeleteIconButton
                          onClick={() => deleteDayType(dt.id)}
                          className="opacity-0 group-hover:opacity-100"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
