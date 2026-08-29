import { describe, expect, it } from "vitest";
import {
  assertActiveBrandKey,
  DECISION_WEIGHTS_V1,
  decisionAnchors,
  money,
  validateDecisionWeights,
} from "../src/index.js";

describe("decision policy", () => {
  it("fixes frozen anchors", () =>
    expect(decisionAnchors(money("USD", 1_000n))).toMatchObject({
      costTargetMinor: 920n,
      costWorstMinor: 1_150n,
      qualityTarget: 4.7,
      leadTargetDays: 12,
      paymentTargetBps: 3_000,
    }));
  it.each([0n, -1n])("requires positive baseline %s", (minor) =>
    expect(() => decisionAnchors(money("USD", minor))).toThrow(),
  );
  it("accepts frozen weights", () =>
    expect(() => validateDecisionWeights(DECISION_WEIGHTS_V1)).not.toThrow());
  it.each([
    { ...DECISION_WEIGHTS_V1, cost: -0.1 },
    { ...DECISION_WEIGHTS_V1, cost: 0.5 },
  ])("rejects invalid weights", (weights) =>
    expect(() => validateDecisionWeights(weights)).toThrow(),
  );
  it.each([
    ["valden", true],
    ["solenne", false],
    ["VALDEN", false],
  ] as const)("enforces active brand %s", (brand, allowed) => {
    const action = () => assertActiveBrandKey(brand);
    if (allowed) expect(action).not.toThrow();
    else expect(action).toThrow("active Valden");
  });
});
