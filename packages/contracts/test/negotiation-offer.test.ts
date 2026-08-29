import { describe, expect, it } from "vitest";
import { offerProposalSchema, paymentScheduleSchema } from "../src/index.js";

const payment = [
  { milestone: "ORDER", percentBasisPoints: 2_000 },
  { milestone: "DELIVERY", percentBasisPoints: 8_000 },
];
const proposal = {
  supplierId: "S1",
  round: 1,
  message: "We can fulfill this order on the proposed commercial terms.",
  currency: "USD",
  leadTimeDays: 42,
  capacityPercent: 100,
  expiresAt: "2030-01-01T00:00:00.000Z",
  paymentSchedule: payment,
  lines: [{ productId: "p", quantity: "1", unitPriceMinor: "90" }],
};
describe("negotiation offer contract", () => {
  it("accepts a strict valid proposal", () =>
    expect(offerProposalSchema.safeParse(proposal).success).toBe(true));
  it.each([
    [[], false],
    [[{ milestone: "ORDER", percentBasisPoints: 9_999 }], false],
    [payment, true],
  ] as const)("checks payment schedule %#", (schedule, valid) =>
    expect(paymentScheduleSchema.safeParse(schedule).success).toBe(valid),
  );
  it.each([
    { ...proposal, actorId: "supplier" },
    { ...proposal, brandId: "solenne" },
    { ...proposal, lines: [{ ...proposal.lines[0], quantity: "-1" }] },
  ])("rejects spoofed or invalid offer payload", (input) =>
    expect(offerProposalSchema.safeParse(input).success).toBe(false),
  );
});
