import EmployeeTable from "@/components/EmployeeTable";

export default function EmployeesPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0">
        <h1 className="text-3xl font-bold text-slate-800">עובדים</h1>
        <p className="text-slate-500 mt-1 text-sm">
          ייבא קובץ עם שמות העובדים (CSV, XLSX, XLS, ODS). כל עמודה מייצגת קבוצת הרשאה לסוגי משמרות.
        </p>
      </div>
      <div className="flex-1 min-h-0 mt-6">
        <EmployeeTable />
      </div>
    </div>
  );
}
