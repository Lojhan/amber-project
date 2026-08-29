import type { MatchResolution } from "@procurement/application/ports";
import { asActorId, asBrandId } from "@procurement/domain";
import { describe, expect, it } from "vitest";
import { candidateField, selectedProductId } from "./matching-codecs.js";

const resolution = (
  action: MatchResolution["action"],
  selectedProductId?: string,
): MatchResolution => ({
  brandId: asBrandId("brand"),
  actorId: asActorId("actor"),
  quotationId: "quotation",
  scenarioId: "scenario",
  matchId: "match",
  action,
  ...(selectedProductId === undefined ? {} : { selectedProductId }),
});

describe("matching codecs", () => {
  it("reads normalized parser fields without treating malformed values as text", () => {
    expect(candidateField({ sku: { value: "SKU-1" } }, "sku")).toBe("SKU-1");
    expect(candidateField({ sku: "SKU-1" }, "sku")).toBeUndefined();
  });

  it("uses an explicit selection before the top ranked candidate", () => {
    const candidates = { candidates: [{ product: { id: "first" } }] };
    expect(selectedProductId(resolution("accept", "chosen"), candidates)).toBe(
      "chosen",
    );
    expect(selectedProductId(resolution("accept"), candidates)).toBe("first");
  });

  it("never selects a product for exclusions", () => {
    expect(
      selectedProductId(resolution("exclude", "must-not-use"), {
        candidates: [{ product: { id: "first" } }],
      }),
    ).toBeUndefined();
  });
});
