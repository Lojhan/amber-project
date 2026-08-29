import { asActorId, asBrandId } from "@procurement/domain";
import { describe, expect, it } from "vitest";
import { HmacConfirmationTokenService } from "./system-adapters.js";

describe("purchase-order confirmation tokens", () => {
  it("binds confirmation to the actor, brand, facts, and lifetime", () => {
    const service = new HmacConfirmationTokenService("s".repeat(32), 1_000);
    const claims = {
      digest: "digest",
      negotiationId: "negotiation",
      offerId: "offer",
      brandId: asBrandId("brand"),
      actorId: asActorId("actor"),
    };
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const token = service.issue(claims, issuedAt);

    expect(service.verify(token, claims, issuedAt)).toBe(true);
    expect(
      service.verify(token, { ...claims, offerId: "other" }, issuedAt),
    ).toBe(false);
    expect(
      service.verify(token, claims, new Date(issuedAt.getTime() + 1_001)),
    ).toBe(false);
  });

  it("returns only the signed policy bound to the actor and scenario", () => {
    const service = new HmacConfirmationTokenService("s".repeat(32), 1_000);
    const policy = {
      version: "decision-policy-v1",
      hash: "a".repeat(64),
      weights: {
        cost: "0.45",
        quality: "0.25",
        lead: "0.20",
        payment: "0.10",
      },
      interpretation: {
        primaryPriority: null,
        hardMaxLeadDays: null,
        summary: "The standard buying policy applies.",
        warnings: [],
        source: "default" as const,
      },
    };
    const claims = {
      quotationId: "quotation",
      scenarioId: "scenario",
      policy,
      brandId: asBrandId("brand"),
      actorId: asActorId("actor"),
    };
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const token = service.issuePolicy(claims, issuedAt);

    expect(
      service.verifyPolicy(
        token,
        {
          ...claims,
          policyHash: policy.hash,
        },
        issuedAt,
      ),
    ).toEqual(policy);
    expect(
      service.verifyPolicy(
        token,
        {
          ...claims,
          scenarioId: "other",
          policyHash: policy.hash,
        },
        issuedAt,
      ),
    ).toBeNull();
  });
});
