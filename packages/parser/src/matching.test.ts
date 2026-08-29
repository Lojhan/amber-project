import { describe, expect, it } from "vitest";
import { matchSku } from "./matching.js";
import { osaDistance } from "./normalize.js";

describe("SKU matching", () => {
  it("counts an adjacent transposition as one edit", () => {
    expect(osaDistance("AB12", "BA12")).toBe(1);
  });

  it("selects an exact SKU inside the active brand", () => {
    expect(
      matchSku("AQ009-OBS-XS", [{ brand: "valden", sku: "AQ009-OBS-XS" }])
        .status,
    ).toBe("matched");
  });

  it("keeps close candidates for manual review", () => {
    expect(
      matchSku("AP004-GLW-28", [
        { brand: "valden", sku: "AP004-GLW-28A" },
        { brand: "valden", sku: "AP004-GLW-28B" },
      ]).status,
    ).toBe("needs_review");
  });
});
