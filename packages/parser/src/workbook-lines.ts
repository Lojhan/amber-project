import type ExcelJS from "exceljs";
import { cellEvidence } from "./cell-evidence.js";
import type { Field, ParsedLine, Warning } from "./types.js";
import { isBlank, toScalar } from "./workbook-values.js";

export function median(
  rows: unknown[][],
  run: { start: number; end: number },
  column: number,
): number {
  const values = rows
    .slice(run.start, run.end + 1)
    .map((row) => toScalar(row[column]))
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);
  return values.length
    ? values[Math.floor(values.length / 2)]!
    : Number.POSITIVE_INFINITY;
}

export function parseLine(
  sheet: ExcelJS.Worksheet,
  values: unknown[][],
  headerRow: number,
  columns: Record<string, number | undefined>,
  priceColumns: number[],
  conflict: boolean,
  rowIndex: number,
): ParsedLine | undefined {
  const row = values[rowIndex]!;
  const skuColumn = columns.sku!;
  if (isBlank(toScalar(row[skuColumn]))) return undefined;
  const evidence = (column: number) =>
    cellEvidence(sheet, rowIndex + 1, column + 1);
  const field = (
    column: number | undefined,
    confidence = 0.9,
  ): Field<string> | undefined =>
    column === undefined || isBlank(toScalar(row[column]))
      ? undefined
      : {
          value: String(toScalar(row[column])),
          evidence: [evidence(column)],
          confidence,
        };
  const quantity = field(columns.quantity);
  const unitPrice = field(columns.unitPrice);
  const tiers = priceColumns
    .map((column) => {
      const price = field(column);
      const minimum = String(values[headerRow]![column] ?? "").match(
        /(?:qty|quantity)\s*(\d+)/i,
      )?.[1];
      return price
        ? {
            ...(minimum ? { minimumQuantity: Number(minimum) } : {}),
            unitPrice: price,
          }
        : undefined;
    })
    .filter((value): value is NonNullable<typeof value> => value !== undefined);
  const warnings: Warning[] = quantity
    ? []
    : [
        {
          code: "missing_requested_quantity",
          message: "No requested quantity was found",
        },
      ];
  if (conflict)
    warnings.push({
      code: "field_role_conflict",
      message: "Header roles conflict with cross-row numeric distributions",
      evidence: [evidence(columns.quantity!), evidence(columns.unitPrice!)],
    });
  const parsedLine: ParsedLine = {
    evidence: [
      evidence(skuColumn),
      ...(quantity?.evidence ?? []),
      ...(unitPrice?.evidence ?? []),
    ],
    quantityCandidates: quantity ? [quantity] : [],
    unitPriceCandidates: unitPrice ? [unitPrice] : [],
    tiers,
    fieldRoleStatus: conflict ? "ambiguous" : "resolved",
    confidence: conflict ? 0.45 : 0.85,
    warnings,
  };
  const sku = field(skuColumn, 1);
  const description = field(columns.description);
  if (sku) parsedLine.sku = sku;
  if (description) parsedLine.description = description;
  return parsedLine;
}
