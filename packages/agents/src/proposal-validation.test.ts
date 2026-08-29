import type { OfferProposal } from "@procurement/contracts";
import { describe, expect, it } from "vitest";
import { validateProposal } from "./proposal-validation.js";
import type { NegotiationContext } from "./types.js";

const context: NegotiationContext = {
  brandId: "valden-id",
  quotationId: "quotation-1",
  round: 1,
  currency: "USD",
  lines: [{ productId: "p", quantity: "2", baselineUnitPriceMinor: "100" }],
};
const valid: OfferProposal = {
  supplierId: "S1",
  round: 1,
  message: "We can fulfill this order on the proposed commercial terms.",
  currency: "USD",
  leadTimeDays: 50,
  capacityPercent: 100,
  expiresAt: "2030-01-01T00:00:00.000Z",
  paymentSchedule: [
    { milestone: "ORDER", percentBasisPoints: 3300 },
    { milestone: "PRE_SHIPMENT", percentBasisPoints: 3300 },
    { milestone: "DELIVERY", percentBasisPoints: 3400 },
  ],
  lines: [{ productId: "p", quantity: "2", unitPriceMinor: "100" }],
};
const now = new Date("2029-01-01T00:00:00.000Z");
const rejected = (proposal: unknown, supplier = "S1") => {
  const result = validateProposal(
    proposal,
    supplier as "S1" | "S2" | "S3",
    context,
    now,
  );
  if (result.valid) throw new Error("expected rejection");
  return result;
};
describe("proposal validation gates", () => {
  it("accepts a valid schema, supplier policy, and full offer", () =>
    expect(validateProposal(valid, "S1", context, now).valid).toBe(true));
  it("requires the exact challenge opening profile in round one", () =>
    expect(
      rejected({
        ...valid,
        leadTimeDays: 49,
        lines: [{ ...valid.lines[0]!, unitPriceMinor: "99" }],
      }),
    ).toMatchObject({ reasons: ["round-lead-policy"] }));
  it("rejects schema failures", () =>
    expect(rejected({}).reasons[0]).toMatch(/^schema:/));
  it("rejects supplier identity changes", () =>
    expect(rejected({ ...valid, supplierId: "S2" })).toMatchObject({
      reasons: ["supplier-identity"],
    }));
  it("rejects a changed round", () =>
    expect(rejected({ ...valid, round: 2 })).toMatchObject({
      reasons: ["round-mismatch"],
    }));
  it("rejects a changed currency", () =>
    expect(rejected({ ...valid, currency: "EUR" })).toMatchObject({
      reasons: ["price-currency"],
    }));
  it("rejects incomplete line coverage", () =>
    expect(rejected({ ...valid, lines: [] })).toMatchObject({
      reasons: ["schema:lines"],
    }));
  it("rejects quantity mismatch", () =>
    expect(
      rejected({ ...valid, lines: [{ ...valid.lines[0]!, quantity: "1" }] }),
    ).toMatchObject({ reasons: ["offer-complete"] }));
  it("rejects an expired proposal", () =>
    expect(
      rejected({ ...valid, expiresAt: "2020-01-01T00:00:00.000Z" }),
    ).toMatchObject({ reasons: ["offer-expired"] }));
  it("rejects out-of-policy pricing", () =>
    expect(
      rejected({
        ...valid,
        lines: [{ ...valid.lines[0]!, unitPriceMinor: "90" }],
      }),
    ).toMatchObject({ reasons: ["price-policy"] }));
  it("rejects an out-of-policy payment burden", () =>
    expect(
      rejected({
        ...valid,
        paymentSchedule: [{ milestone: "ORDER", percentBasisPoints: 10000 }],
      }),
    ).toMatchObject({ reasons: ["payment-policy"] }));
  it("rejects a partial capacity outside the mandated S2 round-two event", () =>
    expect(rejected({ ...valid, capacityPercent: 60 })).toMatchObject({
      reasons: ["capacity-event-mismatch"],
    }));
  it("accepts the mandated S2 round-two partial commercial fact", () => {
    const proposal = {
      ...valid,
      supplierId: "S2" as const,
      round: 2 as const,
      capacityPercent: 60,
      leadTimeDays: 22,
      paymentSchedule: [
        { milestone: "ORDER" as const, percentBasisPoints: 3000 },
        { milestone: "DELIVERY" as const, percentBasisPoints: 7000 },
      ],
      lines: valid.lines.map((line) => ({ ...line, unitPriceMinor: "107" })),
    };
    expect(
      validateProposal(proposal, "S2", { ...context, round: 2 }),
    ).toMatchObject({ valid: true });
  });
  it("accepts an exact round multiplier rounded to the nearest minor unit", () => {
    const fractionalContext: NegotiationContext = {
      ...context,
      lines: [{ productId: "p", quantity: "2", baselineUnitPriceMinor: "625" }],
    };
    const proposal: OfferProposal = {
      ...valid,
      supplierId: "S2",
      leadTimeDays: 25,
      paymentSchedule: [
        { milestone: "ORDER", percentBasisPoints: 4000 },
        { milestone: "DELIVERY", percentBasisPoints: 6000 },
      ],
      lines: [{ productId: "p", quantity: "2", unitPriceMinor: "719" }],
    };

    expect(
      validateProposal(proposal, "S2", fractionalContext, now),
    ).toMatchObject({ valid: true });
  });
});
