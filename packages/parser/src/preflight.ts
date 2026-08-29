import { validateOoxmlGraph } from "./ooxml-relationships.js";
import type { ParserLimits } from "./types.js";
import { validateWorksheetLimits } from "./worksheet-limits.js";
import { inspectZip, type ZipInventory } from "./zip-preflight.js";

const defaults: ParserLimits = {
  maxBytes: 25 * 1024 * 1024,
  maxExpandedBytes: 150 * 1024 * 1024,
  maxSheets: 30,
  maxRows: 10_000,
  maxColumns: 256,
  maxCells: 500_000,
};

export interface PreflightResult {
  ok: boolean;
  entries: string[];
  expandedBytes: number;
  reason?: string;
}

export interface PreflightDependencies {
  inspect: (bytes: Uint8Array, limits: ParserLimits) => Promise<ZipInventory>;
}

/** A safe, central-directory-first gate before ExcelJS sees untrusted bytes. */
export async function preflightOOXML(
  bytes: Uint8Array,
  supplied: Partial<ParserLimits> = {},
  dependencies: PreflightDependencies = { inspect: inspectZip },
): Promise<PreflightResult> {
  const limits = { ...defaults, ...supplied };
  let inventory: ZipInventory | undefined;

  try {
    inventory = await dependencies.inspect(bytes, limits);
    const graph = await validateOoxmlGraph(inventory, limits);
    await validateWorksheetLimits(inventory, graph.worksheetParts, limits);

    return {
      ok: true,
      entries: inventory.entries.map((entry) => entry.name),
      expandedBytes: inventory.expandedBytes,
    };
  } catch (error) {
    return {
      ok: false,
      entries: inventory?.entries.map((entry) => entry.name) ?? [],
      expandedBytes: inventory?.expandedBytes ?? 0,
      reason: error instanceof Error ? error.message : "preflight_error",
    };
  } finally {
    inventory?.close();
  }
}
