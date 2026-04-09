/**
 * Shared ExcelJS styling: monochrome table, RTL, print-friendly (used by nursing + doctors exports).
 */
import type { Cell, Worksheet } from "exceljs";

export function triggerXlsxDownload(data: BlobPart, filename: string) {
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Single thin grid everywhere — avoids a thicker “frame” and odd double edges in print */
const BORDER_THIN = { style: "thin" as const, color: { argb: "FF000000" } };
const FILL_WHITE = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFFFFFFF" },
};

function applyCellBorders(cell: Cell) {
  cell.border = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_THIN,
    right: BORDER_THIN,
  };
}

/**
 * Print: landscape A4, fit **width** to one page so all columns print; rows may span pages
 * (fitToHeight: 1 was shrinking text and clipping wrapped Hebrew names).
 * No frozen panes — freezing draws a heavy line under row 1 in print preview.
 */
export function applyPrintSheetDefaults(worksheet: Worksheet) {
  worksheet.views = [{ rightToLeft: true, showGridLines: false }];

  const ps = worksheet.pageSetup as Record<string, unknown>;
  Object.assign(ps, {
    paperSize: 9,
    orientation: "landscape" as const,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 999,
    horizontalCentered: true,
    verticalCentered: false,
    margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 },
  });
  delete ps.scale;
  delete ps.printTitlesRow;
}

function lineCountForHeight(v: unknown): number {
  if (v == null || v === "") return 1;
  return String(v).split(/\r\n|\r|\n/).length;
}

/**
 * Fonts that render Hebrew clearly in Excel (Office picks a fallback if the name is missing).
 * Segoe UI: modern Windows. Tahoma: very common, strong Hebrew metrics.
 */
export const EXCEL_FONT_HEBREW_PRIMARY = "Segoe UI";
export const EXCEL_FONT_HEBREW_FALLBACK = "Tahoma";

export type StyleDataRangeOptions = {
  columnWidths?: number[];
  defaultColWidth?: number;
  /** Default: Segoe UI */
  fontName?: string;
  headerFontSize?: number;
  bodyFontSize?: number;
  /** Max row height (pt). Default ~Excel max (409) so wrapped names are not clipped */
  rowHeightCap?: number;
  /** Points added per wrapped line */
  rowHeightPerLine?: number;
  headerRowHeightMin?: number;
  dataRowHeightMin?: number;
  /** Header cells: centered vertically reads better when scaled for print */
  headerVertical?: "top" | "middle";
  /** Body: top for multi-line cells; middle can help single-line day columns */
  bodyVertical?: "top" | "middle";
};

/** Writes a rectangular grid with white fill, black borders, wrap, RTL; row heights from content. */
export function styleDataRange(
  ws: Worksheet,
  aoa: (string | number)[][],
  options?: StyleDataRangeOptions,
) {
  const defaultW = options?.defaultColWidth ?? 12;
  const fontName = options?.fontName ?? EXCEL_FONT_HEBREW_PRIMARY;
  const headerSz = options?.headerFontSize ?? 10;
  const bodySz = options?.bodyFontSize ?? 9;
  const rowCap = options?.rowHeightCap ?? 409;
  const perLine = options?.rowHeightPerLine ?? 15;
  const headerMin = options?.headerRowHeightMin ?? 26;
  const dataMin = options?.dataRowHeightMin ?? 16;
  const headerV = options?.headerVertical ?? "middle";
  const bodyV = options?.bodyVertical ?? "top";

  const maxR = aoa.length;
  if (maxR === 0) return;
  const maxC = Math.max(...aoa.map(row => row.length), 1);
  const padded = aoa.map(row => {
    const copy = [...row];
    while (copy.length < maxC) copy.push("");
    return copy;
  });

  for (let c = 1; c <= maxC; c++) {
    const w = options?.columnWidths?.[c - 1] ?? defaultW;
    ws.getColumn(c).width = w;
  }

  for (let r = 1; r <= maxR; r++) {
    const excelRow = ws.getRow(r);
    const headerRow = r === 1;
    let maxLines = 1;
    for (let c = 1; c <= maxC; c++) {
      const raw = padded[r - 1][c - 1];
      const cell = excelRow.getCell(c);
      cell.value = raw === "" ? "" : raw;
      maxLines = Math.max(maxLines, lineCountForHeight(cell.value));
      const sz = headerRow ? headerSz : bodySz;
      // charset 177 = Hebrew (Windows/Excel); improves script hinting when Office honors it
      cell.font = {
        name: fontName,
        size: sz,
        bold: headerRow,
        charset: 177,
      };
      cell.alignment = {
        vertical: headerRow ? headerV : bodyV,
        horizontal: headerRow ? "center" : "right",
        wrapText: true,
        readingOrder: "rtl",
        shrinkToFit: false,
      };
      cell.fill = { ...FILL_WHITE };
      applyCellBorders(cell);
    }
    const needed = Math.max(headerRow ? headerMin : dataMin, 8 + maxLines * perLine);
    excelRow.height = Math.min(rowCap, needed);
  }
}
