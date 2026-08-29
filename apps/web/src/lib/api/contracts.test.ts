import { describe, expect, it } from "vitest";
import { decodeDecision, decodeQuotation } from "./contracts";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix}`;

describe("API contract decoders", () => {
  it("accepts a decision that is not ready yet", () => {
    expect(decodeDecision(null)).toBeNull();
  });

  it("rejects an object missing the authoritative decision fields", () => {
    expect(() => decodeDecision({})).toThrow();
  });

  it("accepts the durable links needed to resume a quotation", () => {
    expect(
      decodeQuotation({
        id: id("000000000001"),
        status: "READY",
        selectedScenarioId: id("000000000002"),
        negotiationId: id("000000000003"),
        scenarios: [],
        matches: [],
      }),
    ).toMatchObject({
      selectedScenarioId: id("000000000002"),
      negotiationId: id("000000000003"),
    });
  });
});
