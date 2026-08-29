import { readFile } from "node:fs/promises";
import {
  assertScenarioChoice,
  reviewGateForParsedQuote,
} from "@procurement/application";
import { describe, expect, it } from "vitest";
import { type CatalogProduct, matchSku } from "./matching.js";
import { parseWorkbook } from "./workbook.js";

const quotation = async (name: string) =>
  parseWorkbook(
    new Uint8Array(
      await readFile(new URL(`../../../${name}`, import.meta.url)),
    ),
  );

const catalog = async (): Promise<CatalogProduct[]> => {
  const csv = await readFile(
    new URL("../../../products.csv", import.meta.url),
    "utf8",
  );
  const [, ...rows] = csv.trim().split("\n");

  return rows.map((row) => {
    const [brand, sku, name, color] = row.split(",");

    return {
      brand: brand!,
      sku: sku!,
      ...(name ? { name } : {}),
      ...(color ? { color } : {}),
    };
  });
};

describe("supplied quotation workbooks", () => {
  it("keeps quotation 1 alternatives explicit", async () => {
    const parsed = await quotation("quotation_1.xlsx");
    const scenarioIds = parsed.scenarios.map((scenario) => scenario.id);

    expect(parsed.scenarios).toHaveLength(2);
    expect(
      parsed.scenarios
        .map((scenario) =>
          Number(scenario.lines[0]?.quantityCandidates[0]?.value),
        )
        .sort((left, right) => left - right),
    ).toEqual([500, 5000]);
    expect(reviewGateForParsedQuote(parsed).reasons).toContain(
      "scenario_choice_required",
    );
    expect(() => assertScenarioChoice(scenarioIds, undefined)).toThrowError(
      /explicit scenario choice/,
    );
  });

  it("keeps quotation 2 reviewable when requested quantity is absent", async () => {
    const parsed = await quotation("quotation_2.xlsx");
    const line = parsed.scenarios[0]?.lines[0];

    expect(line?.quantityCandidates).toHaveLength(0);
    expect(line?.tiers.map((tier) => tier.minimumQuantity)).toEqual([
      1000, 5000,
    ]);
    expect(reviewGateForParsedQuote(parsed).reasons).toContain(
      "missing_requested_quantity",
    );
  });

  it("preserves quotation 3 as two quote scenarios", async () => {
    const parsed = await quotation("quotation_3.xlsx");

    expect(parsed.scenarios.map((scenario) => scenario.label).sort()).toEqual([
      "Quote 1",
      "Quote 2",
    ]);
    expect(
      parsed.scenarios.every((scenario) => scenario.lines.length === 23),
    ).toBe(true);
  });

  it("blocks quotation 4 on ambiguous field roles", async () => {
    const parsed = await quotation("quotation_4.xlsx");

    expect(parsed.scenarios[0]?.lines).toHaveLength(23);
    expect(
      parsed.scenarios[0]?.lines.every(
        (line) => line.fieldRoleStatus === "ambiguous",
      ),
    ).toBe(true);
    expect(reviewGateForParsedQuote(parsed).reasons).toContain(
      "field_role_conflict",
    );
  });

  it("matches within the requested catalog brand", async () => {
    const products = await catalog();

    expect(matchSku("OB007-BAS-L", products, "valden").status).toBe("matched");
    expect(matchSku("AQ009-0BS-XS", products, "valden").status).toBe(
      "needs_review",
    );
    expect(matchSku("OB007-BAS-L", products, "solenne").status).toBe(
      "not_found",
    );
  });
});
