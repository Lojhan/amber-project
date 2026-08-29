import { describe, expect, it } from "vitest";
import { matchCandidates } from "./match-candidates.js";

describe("match candidate projection", () => {
  it("exposes only usable catalog candidates", () => {
    expect(
      matchCandidates({
        candidates: [
          {
            product: { id: "product-1", sku: "SKU-1", name: "Jacket" },
            score: 0.94,
          },
          { product: { id: "missing-fields" } },
        ],
      }),
    ).toEqual([
      {
        productId: "product-1",
        sku: "SKU-1",
        name: "Jacket",
        score: 0.94,
      },
    ]);
  });
});
