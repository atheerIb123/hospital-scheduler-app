/**
 * Nursing weekly schedule Excel export using ExcelJS (reliable borders, wrap, print layout).
 */
import type { DayStatus, EmployeeWeekPlan, WeeklyShiftRow } from "@/lib/types";
import { applyPrintSheetDefaults, styleDataRange, triggerXlsxDownload } from "@/lib/excelStyledTable";

const HE_DAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

/** Excel line break — CRLF wraps reliably when printing */
const XL_LF = "\r\n";

function weekRangeLabel(iso: string): string {
  const start = new Date(iso + "T12:00:00");
  const end = new Date(iso + "T12:00:00");
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function nursingWeekDayHeaderExcel(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const dow = HE_DAYS_SHORT[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dow} ${dd}/${mm}`;
}

function safeExcelFilenamePart(s: string): string {
  const t = s.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return t.slice(0, 48) || "סידור";
}

function formatDayStatusesForExcel(statuses: DayStatus[]): string {
  if (!statuses.length) return "";
  return statuses
    .map(s => {
      if (s.type === "shift") return s.shift_name;
      if (s.type === "cross_dept") return `${s.shift_name} (מחלקת ${s.department})`;
      if (s.type === "oncall") return `כוננות: ${s.shift_name}`;
      if (s.type === "constraint") return s.reason || "חסום";
      return "פנוי";
    })
    .join(XL_LF);
}

const SHIFT_LEADER_ROLE_SLOT = "אחראי משמרת";
const SHIFT_LEADER_EXCEL_PREFIX = "(א׳ משמרת)";

function formatWeeklyGridCellForExcel(
  row: WeeklyShiftRow,
  iso: string,
  shiftLeaderIds: Set<string>,
): string {
  const emps = row.by_day[iso] ?? [];
  if (!emps.length) return "";

  const isReserve = /כוננות|רזרבה/.test(row.shift_name);

  if (row.role_slot === SHIFT_LEADER_ROLE_SLOT) {
    return emps.map(e => `${SHIFT_LEADER_EXCEL_PREFIX} ${e.employee_name}`).join(XL_LF);
  }

  if (isReserve) {
    return emps.map(e => e.employee_name).join(XL_LF);
  }

  const cellLeaderId = emps.find(e => shiftLeaderIds.has(e.employee_id))?.employee_id;
  return emps
    .map(e =>
      e.employee_id === cellLeaderId
        ? `${SHIFT_LEADER_EXCEL_PREFIX} ${e.employee_name}`
        : e.employee_name,
    )
    .join(XL_LF);
}

export async function downloadNursingWeeklyGridXlsx(
  grid: WeeklyShiftRow[],
  weekDays: string[],
  weekStartIso: string,
  departmentLabel: string,
  shiftLeaderIds: Set<string>,
): Promise<void> {
  if (!grid.length || !weekDays.length) return;

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("סידור שבועי", {
    properties: { defaultColWidth: 14, defaultRowHeight: 20 },
  });

  const headers = ["משמרת", ...weekDays.map(nursingWeekDayHeaderExcel)];
  const body = grid.map(row => {
    const label = row.hours ? `${row.shift_name} (${row.hours})` : row.shift_name;
    const cells = weekDays.map(iso => formatWeeklyGridCellForExcel(row, iso, shiftLeaderIds));
    return [label, ...cells];
  });
  const aoa: (string | number)[][] = [headers, ...body];

  applyPrintSheetDefaults(ws);
  // Wide columns + generous row height (no low cap) so wrapped names are not clipped
  styleDataRange(ws, aoa, {
    columnWidths: [38, ...weekDays.map(() => 16)],
    defaultColWidth: 14,
    headerFontSize: 10,
    bodyFontSize: 9,
    rowHeightPerLine: 15,
    headerRowHeightMin: 30,
    dataRowHeightMin: 22,
    headerVertical: "middle",
    bodyVertical: "top",
  });

  const dept = safeExcelFilenamePart(departmentLabel || "כל_המחלקות");
  const week = safeExcelFilenamePart(weekRangeLabel(weekStartIso).replace(/\s/g, "_"));
  const buf = await wb.xlsx.writeBuffer();
  triggerXlsxDownload(buf, `סידור_שבועי_${dept}_${week}.xlsx`);
}

export async function downloadNursingEmployeePlanXlsx(
  plan: EmployeeWeekPlan[],
  weekDays: string[],
  weekStartIso: string,
  departmentLabel: string,
): Promise<void> {
  if (!plan.length || !weekDays.length) return;

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("תכנון עובדים", {
    properties: { defaultColWidth: 11, defaultRowHeight: 18 },
  });

  const headers = ["עובד", "מחלקה", ...weekDays.map(nursingWeekDayHeaderExcel)];
  const body = plan.map(emp => [
    emp.employee_name,
    emp.home_department ?? "",
    ...weekDays.map(iso =>
      formatDayStatusesForExcel(emp.days[iso] ?? [{ type: "off" }]),
    ),
  ]);
  const aoa: (string | number)[][] = [headers, ...body];

  applyPrintSheetDefaults(ws);
  styleDataRange(ws, aoa, {
    columnWidths: [24, 15, ...weekDays.map(() => 16)],
    defaultColWidth: 12,
    rowHeightPerLine: 15,
    headerVertical: "middle",
    bodyVertical: "top",
  });

  const dept = safeExcelFilenamePart(departmentLabel || "כל_המחלקות");
  const week = safeExcelFilenamePart(weekRangeLabel(weekStartIso).replace(/\s/g, "_"));
  const buf = await wb.xlsx.writeBuffer();
  triggerXlsxDownload(buf, `תכנון_עובדים_${dept}_${week}.xlsx`);
}
