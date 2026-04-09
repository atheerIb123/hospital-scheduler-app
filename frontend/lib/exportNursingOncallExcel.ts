/**
 * Nursing on-call (כוננות) monthly table — ExcelJS + same print/border styling as סידור שבועי.
 */
import type { Cell } from "exceljs";
import type { OncallDay, OncallSlot } from "@/lib/types";
import { applyPrintSheetDefaults, triggerXlsxDownload } from "@/lib/excelStyledTable";

const SLOTS: OncallSlot[] = ["ערב_1", "ערב_2", "לילה"];

const SLOT_LABELS: Record<OncallSlot, string> = {
  ערב_1: "כוננות ערב I",
  ערב_2: "כוננות ערב II",
  לילה: "כוננות לילה",
};

const HE_DAYS_XL = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

const MONTH_NAMES = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

const XL_LF = "\r\n";

const BORDER_THIN = { style: "thin" as const, color: { argb: "FF000000" } };
const FILL_WHITE = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFFFFFFF" },
};

function applyThinBorder(cell: Cell) {
  cell.border = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_THIN,
    right: BORDER_THIN,
  };
}

function safeFilenamePart(s: string): string {
  const t = s.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return t.slice(0, 48) || "כוננות";
}

type RowKind = "date" | "dept" | "emp";

function buildOncallGrid(days: OncallDay[]): {
  aoa: (string | number)[][];
  rowKinds: RowKind[];
  maxCols: number;
  secondChunkLen: number;
  secondChunkStartRow: number;
} {
  if (!days.length) {
    return { aoa: [], rowKinds: [], maxCols: 0, secondChunkLen: 0, secondChunkStartRow: -1 };
  }

  const firstHalf = days.slice(0, 16);
  const secondHalf = days.slice(16);
  const maxCols = Math.max(firstHalf.length, secondHalf.length);

  const aoa: (string | number)[][] = [];
  const rowKinds: RowKind[] = [];
  const empty = (): (string | number)[] => new Array(2 + maxCols).fill("");

  function pushChunk(chunk: OncallDay[]) {
    const dateRow = empty();
    dateRow[0] = "תאריך";
    chunk.forEach((day, i) => {
      const d = new Date(day.date + "T12:00:00");
      dateRow[2 + i] = `${HE_DAYS_XL[d.getDay()]}${XL_LF}${d.getDate()}`;
    });
    aoa.push(dateRow);
    rowKinds.push("date");

    for (const slot of SLOTS) {
      const deptRow = empty();
      deptRow[0] = SLOT_LABELS[slot];
      deptRow[1] = "מחלקה";
      chunk.forEach((day, i) => {
        deptRow[2 + i] = day.slots[slot].department || "";
      });
      aoa.push(deptRow);
      rowKinds.push("dept");

      const empRow = empty();
      empRow[1] = "הפעלה";
      chunk.forEach((day, i) => {
        empRow[2 + i] = day.slots[slot].assignment?.employee_name || "";
      });
      aoa.push(empRow);
      rowKinds.push("emp");
    }
  }

  pushChunk(firstHalf);
  let secondChunkStartRow = -1;
  if (secondHalf.length > 0) {
    secondChunkStartRow = aoa.length + 1;
    pushChunk(secondHalf);
  }

  return {
    aoa,
    rowKinds,
    maxCols,
    secondChunkLen: secondHalf.length,
    secondChunkStartRow,
  };
}

function addChunkMerges(ws: import("exceljs").Worksheet, baseRow1: number) {
  ws.mergeCells(baseRow1, 1, baseRow1, 2);
  for (let si = 0; si < 3; si++) {
    const r = baseRow1 + 1 + si * 2;
    ws.mergeCells(r, 1, r + 1, 1);
  }
}

/** ExcelJS can drop merged-cell text if only the slave was written; set masters explicitly. */
function setSlotLabelMasters(ws: import("exceljs").Worksheet, baseRow1: number) {
  SLOTS.forEach((slot, si) => {
    const r = baseRow1 + 1 + si * 2;
    ws.getRow(r).getCell(1).value = SLOT_LABELS[slot];
  });
}

function styleOncallSheet(
  ws: import("exceljs").Worksheet,
  rowKinds: RowKind[],
  maxCols: number,
) {
  const fontName = "Segoe UI";
  const maxR = rowKinds.length;

  for (let r = 1; r <= maxR; r++) {
    const kind = rowKinds[r - 1];
    const excelRow = ws.getRow(r);
    let maxLines = 1;

    for (let c = 1; c <= 2 + maxCols; c++) {
      const cell = excelRow.getCell(c);
      maxLines = Math.max(maxLines, String(cell.value ?? "").split(/\r\n|\r|\n/).length);

      const isDate = kind === "date";

      cell.font = {
        name: fontName,
        size: isDate ? 10 : 9,
        bold: isDate || c === 1 || c === 2,
        charset: 177,
      };
      cell.fill = { ...FILL_WHITE };
      applyThinBorder(cell);

      if (isDate) {
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
          readingOrder: "rtl",
        };
      } else if (c === 1) {
        cell.alignment = {
          vertical: "middle",
          horizontal: "right",
          wrapText: true,
          readingOrder: "rtl",
        };
      } else if (c === 2) {
        cell.alignment = {
          vertical: "middle",
          horizontal: "right",
          wrapText: true,
          readingOrder: "rtl",
        };
      } else {
        cell.alignment = {
          vertical: "top",
          horizontal: "right",
          wrapText: true,
          readingOrder: "rtl",
        };
      }
    }

    const minH = kind === "date" ? 30 : kind === "dept" ? 22 : 22;
    excelRow.height = Math.min(409, Math.max(minH, 8 + maxLines * 15));
  }
}

export async function downloadNursingOncallXlsx(
  days: OncallDay[],
  month: number,
  year: number,
): Promise<void> {
  if (!days.length) return;

  const { aoa, rowKinds, maxCols, secondChunkLen, secondChunkStartRow } = buildOncallGrid(days);

  if (!aoa.length) return;

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const monthName = MONTH_NAMES[month - 1];
  const ws = wb.addWorksheet(`${monthName} ${year}`, {
    properties: { defaultColWidth: 10, defaultRowHeight: 22 },
  });

  for (let r = 0; r < aoa.length; r++) {
    const row = ws.getRow(r + 1);
    const src = aoa[r];
    for (let c = 0; c < src.length; c++) {
      row.getCell(c + 1).value = src[c] === "" ? "" : src[c];
    }
  }

  addChunkMerges(ws, 1);
  setSlotLabelMasters(ws, 1);
  if (secondChunkLen > 0 && secondChunkStartRow > 0) {
    addChunkMerges(ws, secondChunkStartRow);
    setSlotLabelMasters(ws, secondChunkStartRow);
  }

  applyPrintSheetDefaults(ws);
  styleOncallSheet(ws, rowKinds, maxCols);

  const widths = [20, 10, ...Array(maxCols).fill(11)];
  for (let c = 1; c <= widths.length; c++) {
    ws.getColumn(c).width = widths[c - 1] ?? 10;
  }

  const buf = await wb.xlsx.writeBuffer();
  const m = safeFilenamePart(monthName);
  const y = String(year);
  triggerXlsxDownload(buf, `כוננויות_${m}_${y}.xlsx`);
}
