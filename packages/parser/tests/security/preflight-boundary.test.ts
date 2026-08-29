import { describe, expect, it, vi } from "vitest";
import { preflightOOXML } from "../../src/preflight.js";
import { createWorkbookParser } from "../../src/workbook.js";
import type { ZipInventory } from "../../src/zip-preflight.js";

describe("preflight lifecycle", () => {
  it("does not invoke ExcelJS when preflight rejects", async () => {
    const loader = vi.fn();
    const parse = createWorkbookParser(loader);

    await expect(parse(new Uint8Array([0, 1, 2]))).rejects.toThrow(
      "OOXML preflight rejected input: not_zip",
    );
    expect(loader).not.toHaveBeenCalled();
  });

  it("closes an accepted inventory exactly once after graph failure", async () => {
    const close = vi.fn();
    const inventory = emptyInventory(close);
    const inspect = vi.fn().mockResolvedValue(inventory);

    await expect(
      preflightOOXML(new Uint8Array([1]), {}, { inspect }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "missing_required_part",
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("maps non-Error failures to a stable fallback", async () => {
    const inspect = vi.fn().mockRejectedValue("bad");
    await expect(
      preflightOOXML(new Uint8Array([1]), {}, { inspect }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "preflight_error",
    });
  });
});

function emptyInventory(close: () => void): ZipInventory {
  const zip = {
    openReadStream: () => undefined,
    close: () => undefined,
  } satisfies Pick<ZipInventory["zip"], "openReadStream" | "close">;

  return { zip, entries: [], expandedBytes: 0, close };
}
