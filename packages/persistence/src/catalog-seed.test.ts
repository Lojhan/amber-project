import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  brandSeedIds,
  buildCatalogSeedPlan,
  parseCatalogCsv,
} from "./catalog-seed.js";

const catalog = readFileSync(join(process.cwd(), "../../products.csv"), "utf8");

describe("catalog seed parser", () => {
  const rows = parseCatalogCsv(catalog);

  it("imports both explicitly scoped brands", () => {
    expect(rows.some((row) => row.brand === "valden")).toBe(true);
    expect(rows.some((row) => row.brand === "solenne")).toBe(true);
  });

  it("preserves nullable fields and known Valden data", () => {
    expect(rows.some((row) => row.name === null || row.color === null)).toBe(
      true,
    );
    expect(rows).toContainEqual(
      expect.objectContaining({ brand: "valden", sku: "OB007-BAS-L" }),
    );
  });

  it("handles RFC4180 quotes, commas, escaped quotes, and newlines", () => {
    expect(
      parseCatalogCsv(
        'brand,sku,name,color\r\nvalden,V1,"Jacket, ""Storm""","Blue\nGrey"\r\nsolenne,S1,,',
      ),
    ).toEqual([
      {
        brand: "valden",
        sku: "V1",
        name: 'Jacket, "Storm"',
        color: "Blue\nGrey",
      },
      { brand: "solenne", sku: "S1", name: null, color: null },
    ]);
  });

  it("builds deterministic, complete, non-destructive plans", () => {
    const plan = buildCatalogSeedPlan(catalog);
    expect(plan).toEqual(buildCatalogSeedPlan(catalog));
    expect(plan.rows[0]?.brandId).toBe(brandSeedIds.valden);
    expect(plan.counts.valden).toBeGreaterThan(0);
    expect(plan.counts.solenne).toBeGreaterThan(0);
    expect(JSON.stringify(plan)).not.toContain("delete");
  });

  it("rejects malformed or single-brand catalogs", () => {
    expect(() => parseCatalogCsv("broken")).toThrow(
      "unexpected catalog header",
    );
    expect(() =>
      buildCatalogSeedPlan("brand,sku,name,color\nvalden,V1,N,C\n"),
    ).toThrow("catalog must contain both brands");
  });
});
