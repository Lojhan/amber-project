import type ExcelJS from "exceljs";
import type { CellEvidence } from "./types.js";

export function cellEvidence(
  sheet: ExcelJS.Worksheet,
  row: number,
  column: number,
): CellEvidence {
  const cell = sheet.getCell(row, column);
  const value = scalar(cell.value);
  const formula =
    typeof cell.value === "object" &&
    cell.value !== null &&
    "formula" in cell.value
      ? String((cell.value as { formula?: string }).formula)
      : undefined;

  return {
    sheet: sheet.name,
    address: cell.address,
    displayed: cell.text || null,
    raw: value,
    ...(formula ? { formula } : {}),
    ...(cell.numFmt ? { numberFormat: cell.numFmt } : {}),
  };
}

function scalar(value: unknown): string | number | boolean | null {
  if (typeof value === "object" && value !== null && "result" in value)
    return scalar((value as { result?: unknown }).result);
  if (value === null || value === undefined) return null;
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? value
    : String(value);
}
