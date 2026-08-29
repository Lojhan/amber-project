import { describe, expect, it } from "vitest";
import { preflightOOXML } from "../../src/preflight.js";
import { columnNumber } from "../../src/worksheet-limits.js";
import { buildWorkbook } from "../helpers/ooxml-builder.js";

const worksheetWith = (cells: string) => `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData><row r="1">${cells}</row></sheetData>
</worksheet>`;

describe("worksheet resource limits", () => {
  it("rejects a cell beyond the row limit", async () => {
    const worksheet = worksheetWith('<c r="A10001"><v>1</v></c>');
    await expect(
      preflightOOXML(buildWorkbook({ worksheet })),
    ).resolves.toMatchObject({
      ok: false,
      reason: "worksheet_row_limit",
    });
  });

  it("rejects a cell beyond the column limit", async () => {
    const worksheet = worksheetWith('<c r="IW1"><v>1</v></c>');
    await expect(
      preflightOOXML(buildWorkbook({ worksheet })),
    ).resolves.toMatchObject({
      ok: false,
      reason: "worksheet_column_limit",
    });
  });

  it("rejects too many explicit cells", async () => {
    const worksheet = worksheetWith('<c r="A1"/><c r="B1"/><c r="C1"/>');
    await expect(
      preflightOOXML(buildWorkbook({ worksheet }), { maxCells: 2 }),
    ).resolves.toMatchObject({ ok: false, reason: "worksheet_cell_limit" });
  });

  it("allows a worksheet at the configured boundary", async () => {
    const worksheet = worksheetWith('<c r="Z10"><v>1</v></c>');
    await expect(
      preflightOOXML(buildWorkbook({ worksheet }), {
        maxRows: 10,
        maxColumns: 26,
      }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("converts spreadsheet columns without floating-point math", () => {
    expect(columnNumber("A")).toBe(1);
    expect(columnNumber("Z")).toBe(26);
    expect(columnNumber("AA")).toBe(27);
    expect(columnNumber("XFD")).toBe(16_384);
  });
});
