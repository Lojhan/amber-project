import type ExcelJS from "exceljs";
import { discoverHeader } from "./discovery.js";
import { loadExcelWorkbook, type WorkbookLoader } from "./exceljs-loader.js";
import { preflightOOXML } from "./preflight.js";
import type {
  ParsedQuote,
  QuoteScenario,
  SheetInventory,
  SourceRegion,
} from "./types.js";
import { median, parseLine } from "./workbook-lines.js";
import { findPriceColumns, findQuoteRuns } from "./workbook-values.js";

export function createWorkbookParser(
  loadWorkbook: WorkbookLoader = loadExcelWorkbook,
): (bytes: Uint8Array) => Promise<ParsedQuote> {
  return async (bytes) => {
    const preflight = await preflightOOXML(bytes);
    if (!preflight.ok)
      throw new Error(`OOXML preflight rejected input: ${preflight.reason}`);
    return parseWorkbookUnchecked(bytes, loadWorkbook);
  };
}

export const parseWorkbook = createWorkbookParser();

async function parseWorkbookUnchecked(
  bytes: Uint8Array,
  loadWorkbook: WorkbookLoader,
): Promise<ParsedQuote> {
  const workbook = await loadWorkbook(bytes);
  const sheets: SheetInventory[] = workbook.worksheets.map((sheet) => ({
    name: sheet.name,
    state:
      sheet.state === "visible"
        ? "visible"
        : sheet.state === "veryHidden"
          ? "veryHidden"
          : "hidden",
    mergedRegions: [...(sheet.model.merges ?? [])],
    tables: Object.keys(
      (sheet.model as { tables?: Record<string, unknown> }).tables ?? {},
    ),
    relationships: [],
  }));
  const visible = workbook.worksheets.filter(
    (sheet) => sheet.state === "visible",
  );
  const scenarios = visible.flatMap((sheet, index) =>
    extractSheet(
      sheet,
      visible
        .slice(0, index)
        .reduce((count, prior) => count + countSheetScenarios(prior), 0),
    ),
  );
  return {
    parserVersion: "parser-v2",
    sheets,
    scenarios,
    warnings: sheets
      .filter((sheet) => sheet.state !== "visible")
      .map((sheet) => ({
        code: "hidden_sheet",
        message: `Sheet ${sheet.name} excluded by default`,
      })),
  };
}

function countSheetScenarios(sheet: ExcelJS.Worksheet): number {
  const values = readValues(sheet),
    header = discoverHeader(values);
  return header?.columns.sku === undefined
    ? 0
    : findQuoteRuns(values, header.row, header.columns.sku).filter(
        (run) => run.end >= run.start,
      ).length;
}

function readValues(sheet: ExcelJS.Worksheet): unknown[][] {
  return Array.from({ length: sheet.rowCount }, (_, index) =>
    sheet.getRow(index + 1),
  ).map((row) =>
    Array.isArray(row.values) ? (row.values.slice(1) as unknown[]) : [],
  );
}

function extractSheet(
  sheet: ExcelJS.Worksheet,
  offset: number,
): QuoteScenario[] {
  const values = readValues(sheet),
    header = discoverHeader(values);
  if (!header || header.columns.sku === undefined) return [];
  const prices = findPriceColumns(values[header.row]!);
  return findQuoteRuns(values, header.row, header.columns.sku)
    .filter((run) => run.end >= run.start)
    .map((run, index) =>
      makeScenario(
        sheet,
        values,
        header.row,
        header.columns,
        prices,
        run,
        offset + index + 1,
      ),
    );
}

function makeScenario(
  sheet: ExcelJS.Worksheet,
  values: unknown[][],
  headerRow: number,
  columns: Record<string, number | undefined>,
  priceColumns: number[],
  run: { start: number; end: number },
  id: number,
): QuoteScenario {
  const conflict =
    columns.quantity !== undefined &&
    columns.unitPrice !== undefined &&
    median(values, run, columns.quantity) <
      median(values, run, columns.unitPrice);
  const lines = Array.from({ length: run.end - run.start + 1 }, (_, index) =>
    parseLine(
      sheet,
      values,
      headerRow,
      columns,
      priceColumns,
      conflict,
      run.start + index,
    ),
  ).filter((line): line is NonNullable<typeof line> => line !== undefined);
  const region: SourceRegion = {
    sheet: sheet.name,
    startRow: run.start + 1,
    endRow: run.end + 1,
    startColumn: 1,
    endColumn: sheet.columnCount,
  };
  return {
    id: `scenario-${id}`,
    sourceRegions: [region],
    label: sheet.name,
    metadata: {},
    lines,
    groupingReasons: [
      {
        code: "contiguous_quote_region",
        message: "Compatible contiguous SKU rows form one scenario",
      },
    ],
    confidence: lines.length ? 0.85 : 0.2,
  };
}
