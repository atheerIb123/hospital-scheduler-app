import EmployeeTable from "@/components/EmployeeTable";

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">עובדים</h1>
        <p className="text-slate-500 mt-1 text-sm">
          ייבא קובץ עם שמות העובדים (CSV, XLSX, XLS, ODS). כל עמודה מייצגת קבוצת הרשאה לסוגי משמרות.
        </p>
      </div>
      <EmployeeTable />
    </div>
  );
}
