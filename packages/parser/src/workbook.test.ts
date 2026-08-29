import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { createWorkbookParser, parseWorkbook } from "./workbook.js";
import { findQuoteRuns } from "./workbook-values.js";

type LogicalLine = Readonly<{
  sku: string | undefined;
  description: string | undefined;
  quantity: string | undefined;
  unitPrice: string | undefined;
  status: string;
}>;

const sourceRows = [
  { sku: "AA-01", description: "Amber Tee", quantity: 24, price: 700 },
  { sku: "BB-02", description: "Blue Hoodie", quantity: 12, price: 1200 },
] as const;

const workbookFor = (
  columns: readonly (keyof (typeof sourceRows)[number])[],
  leadingBlankRows = 0,
  format = false,
): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Supplier quote");
  for (let index = 0; index < leadingBlankRows; index += 1) sheet.addRow([]);
  sheet.addRow(
    columns.map(
      (column) =>
        ({
          sku: "SKU",
          description: "Description",
          quantity: "Quantity",
          price: "Unit price",
        })[column],
    ),
  );
  for (const row of sourceRows)
    sheet.addRow(columns.map((column) => row[column]));
  if (format) {
    sheet.getRow(leadingBlankRows + 1).font = { bold: true };
    sheet.getColumn(1).width = 28;
    sheet.getCell(leadingBlankRows + 2, 4).numFmt = "$#,##0.00";
  }
  return workbook;
};

const validXlsxBytes = async (): Promise<Uint8Array> => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Preflight only");
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
};

const logicalLines = async (
  workbook: ExcelJS.Workbook,
): Promise<LogicalLine[]> => {
  const parser = createWorkbookParser(async () => workbook);
  const parsed = await parser(await validXlsxBytes());
  return parsed.scenarios.flatMap((scenario) =>
    scenario.lines.map((line) => ({
      sku: line.sku?.value,
      description: line.description?.value,
      quantity: line.quantityCandidates[0]?.value,
      unitPrice: line.unitPriceCandidates[0]?.value,
      status: line.fieldRoleStatus,
    })),
  );
};

describe("safe workbook parsing", () => {
  it("preflights before parsing the supplied workbook", async () => {
    const bytes = new Uint8Array(
      await readFile(new URL("../../../quotation_1.xlsx", import.meta.url)),
    );
    await expect(parseWorkbook(bytes)).resolves.toMatchObject({
      parserVersion: "parser-v2",
    });
  });

  it("never gives ExcelJS a non-ZIP payload", async () => {
    await expect(parseWorkbook(new Uint8Array([0, 1]))).rejects.toThrow(
      "preflight rejected",
    );
  });

  it("flushes a footer run once without a post-loop duplicate", () => {
    expect(
      findQuoteRuns([["sku"], ["A-1"], ["A-2"], ["Total"], ["A-3"]], 0, 0),
    ).toEqual([{ start: 1, end: 2 }]);
  });

  it("preserves logical lines across deterministic column permutations", async () => {
    const expected = await logicalLines(
      workbookFor(["sku", "description", "quantity", "price"]),
    );
    const permutations = [
      ["price", "sku", "quantity", "description"],
      ["description", "quantity", "price", "sku"],
      ["quantity", "description", "sku", "price"],
    ] as const;
    for (const columns of permutations)
      await expect(logicalLines(workbookFor(columns))).resolves.toEqual(
        expected,
      );
  });

  it("preserves logical lines with leading blanks and harmless formatting", async () => {
    const expected = await logicalLines(
      workbookFor(["sku", "description", "quantity", "price"]),
    );
    await expect(
      logicalLines(
        workbookFor(["sku", "description", "quantity", "price"], 4, true),
      ),
    ).resolves.toEqual(expected);
  });
});
