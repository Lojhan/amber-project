import { asBrandId } from "@procurement/domain";
import { describe, expect, it } from "vitest";
import { ParserCatalogMatcher } from "./catalog-matcher.js";

describe("ParserCatalogMatcher", () => {
  it("scores only products mapped into the requested brand scope", () => {
    const result = new ParserCatalogMatcher().match({
      brandId: asBrandId("brand-a"),
      rawSku: "SKU-1",
      catalog: [{ id: "product-a", sku: "SKU-1", name: null, color: null }],
      corroboration: {},
    });
    expect(result.selectedProductId).toBe("product-a");
    expect(result.candidates).toMatchObject({
      candidates: [{ product: { id: "product-a" } }],
    });
  });
});
