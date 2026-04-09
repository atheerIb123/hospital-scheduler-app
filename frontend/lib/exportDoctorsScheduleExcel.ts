/**
 * Doctors monthly schedule Excel export (ExcelJS) — same print/table styling as nursing exports.
 */
import type { Assignment } from "@/lib/types";
import { applyPrintSheetDefaults, styleDataRange, triggerXlsxDownload } from "@/lib/excelStyledTable";

const MONTH_NAMES = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

export type DoctorsShiftTypeLike = { shift_id?: number; names: string[] };

export async function downloadDoctorsScheduleXlsx(params: {
  schedule: { month: number; year: number };
  shiftTypes: DoctorsShiftTypeLike[];
  localAssignments: Assignment[];
}): Promise<void> {
  const { schedule, shiftTypes, localAssignments } = params;
  if (!shiftTypes.length) return;

  const ExcelJS = (await import("exceljs")).default;
  const activeShifts = [...shiftTypes].sort((a, b) => (a.shift_id ?? 0) - (b.shift_id ?? 0));
  const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();

  const lookup: Record<number, Record<string, string>> = {};
  for (const a of localAssignments) {
    if (!lookup[a.day]) lookup[a.day] = {};
    lookup[a.day][a.shift_name] = a.employee_name;
  }

  const schedHeaders = ["יום", ...activeShifts.map(st => st.names.join(", "))];
  const schedRows: string[][] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dayOfWeek = new Date(schedule.year, schedule.month - 1, day).getDay();
    const dayLabel = `${day}${dayOfWeek === 5 ? " (ו)" : dayOfWeek === 6 ? " (ש)" : ""}`;
    return [
      dayLabel,
      ...activeShifts.map(st => lookup[day]?.[st.names[0]] ?? ""),
    ];
  });
  const schedAoA: (string | number)[][] = [schedHeaders, ...schedRows];

  const empMap: Record<string, Record<string, number>> = {};
  for (const a of localAssignments) {
    if (!empMap[a.employee_name]) empMap[a.employee_name] = {};
    empMap[a.employee_name][a.shift_name] = (empMap[a.employee_name][a.shift_name] ?? 0) + 1;
  }
  const summaryHeaders = ["עובד", ...activeShifts.map(st => st.names.join(", ")), "סה״כ"];
  const summaryAoA: (string | number)[][] = [
    summaryHeaders,
    ...Object.entries(empMap).map(([emp, counts]) => {
      const row = activeShifts.map(st => counts[st.names[0]] ?? 0);
      return [emp, ...row, row.reduce((s, v) => s + v, 0)];
    }),
  ];

  const wb = new ExcelJS.Workbook();

  const ws1 = wb.addWorksheet("לוח משמרות", { properties: { defaultRowHeight: 18 } });
  applyPrintSheetDefaults(ws1);
  const w1 = [11, ...activeShifts.map(() => 13)];
  styleDataRange(ws1, schedAoA, { columnWidths: w1, defaultColWidth: 12 });

  const ws2 = wb.addWorksheet("סיכום", { properties: { defaultRowHeight: 18 } });
  applyPrintSheetDefaults(ws2);
  const w2 = [20, ...activeShifts.map(() => 8), 9];
  styleDataRange(ws2, summaryAoA, { columnWidths: w2, defaultColWidth: 10 });

  const monthName = MONTH_NAMES[schedule.month - 1];
  const buf = await wb.xlsx.writeBuffer();
  triggerXlsxDownload(buf, `סידור_${monthName}_${schedule.year}.xlsx`);
}
