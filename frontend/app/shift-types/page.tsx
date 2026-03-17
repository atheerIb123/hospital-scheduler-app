import ShiftTypeTable from "@/components/ShiftTypeTable";

export default function ShiftTypesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">סוגי משמרות</h1>
        <p className="text-slate-500 mt-1 text-sm">
          14 סוגי משמרות קבועים. ערוך שמות לפי הצורך וסמן <span className="text-amber-600 font-semibold">רצוי ★</span> למשמרות שיחולקו באופן שווה בין כל העובדים הזכאים.
        </p>
      </div>
      <ShiftTypeTable />
    </div>
  );
}
