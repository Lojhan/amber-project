import { assertSafeXml } from "./ooxml-relationships.js";
import type { ParserLimits } from "./types.js";
import {
  findZipEntry,
  readZipText,
  type ZipInventory,
} from "./zip-preflight.js";

/** Validates actual worksheet cells, not only an optional dimension tag. */
export async function validateWorksheetLimits(
  inventory: ZipInventory,
  worksheetParts: readonly string[],
  limits: ParserLimits,
): Promise<void> {
  let cellCount = 0;
  for (const part of worksheetParts) {
    const xml = await readZipText(
      inventory.zip,
      findZipEntry(inventory, part),
      Math.min(limits.maxExpandedBytes, 8 * 1024 * 1024),
    );
    assertSafeXml(xml);
    let highestRow = 0;
    let highestColumn = 0;
    for (const match of xml.matchAll(/<c\b[^>]*\br=["']([A-Z]+)(\d+)["']/gi)) {
      highestColumn = Math.max(highestColumn, columnNumber(match[1]!));
      highestRow = Math.max(highestRow, Number(match[2]));
      cellCount += 1;
      if (cellCount > limits.maxCells) throw new Error("worksheet_cell_limit");
    }
    if (highestRow > limits.maxRows) throw new Error("worksheet_row_limit");
    if (highestColumn > limits.maxColumns)
      throw new Error("worksheet_column_limit");
  }
}

export function columnNumber(value: string): number {
  return value
    .toUpperCase()
    .split("")
    .reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0);
}
