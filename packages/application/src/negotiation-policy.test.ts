import { describe, expect, it } from "vitest";
import { deriveNegotiationPolicy } from "./negotiation-policy.js";

describe("negotiation note policy", () => {
  it("turns interpreted lead-time intent into bounded auditable weights", () => {
    const interpretation = {
      primaryPriority: "lead_time" as const,
      hardMaxLeadDays: 30,
      summary: "Delivery within 30 days is the main priority.",
      warnings: [],
      source: "ai" as const,
    };
    const policy = deriveNegotiationPolicy(interpretation);

    expect(policy.weights).toEqual({
      cost: "0.30",
      quality: "0.25",
      lead: "0.35",
      payment: "0.10",
    });
    expect(policy.hardMaxLead).toBe(30);
    expect(policy.interpretation).toEqual(interpretation);
  });

  it("keeps a note without extracted intent on the frozen default policy", () => {
    const policy = deriveNegotiationPolicy({
      primaryPriority: null,
      hardMaxLeadDays: null,
      summary: "No supported preference was found.",
      warnings: ["The request was ambiguous."],
      source: "ai",
    });

    expect(policy.version).toBe("decision-policy-v1");
    expect(policy.weights.cost).toBe("0.45");
    expect(policy.interpretation.warnings).toEqual([
      "The request was ambiguous.",
    ]);
  });

  it("applies an explicit interpreted deadline without changing weights", () => {
    const policy = deriveNegotiationPolicy({
      primaryPriority: null,
      hardMaxLeadDays: 30,
      summary: "Delivery must be within 30 days.",
      warnings: [],
      source: "ai",
    });

    expect(policy.hardMaxLead).toBe(30);
    expect(policy.weights.cost).toBe("0.45");
  });
});
