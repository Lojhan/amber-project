import {
  type OfferProposal,
  offerProposalSchema,
} from "@procurement/contracts";
import {
  asBrandId,
  asOfferId,
  asProductId,
  asQuotationId,
  DomainInvariantError,
  money,
  type Offer,
  type OrderIntent,
  roundMinorByBasisPoints,
  SUPPLIER_ROUND_POLICY_V1,
  validateOfferAgainstSupplierPolicy,
  validateOfferCommercialFacts,
} from "@procurement/domain";
import type { NegotiationContext, SupplierId } from "./types.js";

export type ProposalValidation =
  | Readonly<{ valid: true; proposal: OfferProposal; offer: Offer }>
  | Readonly<{ valid: false; reasons: readonly string[] }>;
const reasonFor = (error: unknown): string =>
  error instanceof DomainInvariantError ? error.code : "proposal-invalid";
const buildIntent = (context: NegotiationContext): OrderIntent => ({
  quotationId: asQuotationId(context.quotationId),
  brandId: asBrandId(context.brandId),
  currency: context.currency,
  lines: context.lines.map((line) => ({
    productId: asProductId(line.productId),
    quantity: BigInt(line.quantity),
    baselineUnitPrice: money(
      context.currency,
      BigInt(line.baselineUnitPriceMinor),
    ),
  })),
});
export const proposalOfferId = (
  proposal: OfferProposal,
  context: NegotiationContext,
): string =>
  `proposal-${context.brandId}-${context.quotationId}-${proposal.supplierId}-${proposal.round}`;
const buildOffer = (
  proposal: OfferProposal,
  context: NegotiationContext,
): Offer => ({
  id: asOfferId(proposalOfferId(proposal, context)),
  supplierId: proposal.supplierId,
  currency: proposal.currency,
  leadTimeDays: proposal.leadTimeDays,
  capacityPercent: proposal.capacityPercent,
  expiresAt: new Date(proposal.expiresAt),
  lines: proposal.lines.map((line) => ({
    productId: asProductId(line.productId),
    quantity: BigInt(line.quantity),
    unitPrice: money(proposal.currency, BigInt(line.unitPriceMinor)),
  })),
  paymentSchedule: proposal.paymentSchedule,
  policyValid: true,
});

const validateRoundPolicy = (
  proposal: OfferProposal,
  context: NegotiationContext,
): string | undefined => {
  const policy = SUPPLIER_ROUND_POLICY_V1[proposal.supplierId][context.round];
  const orderBps = proposal.paymentSchedule
    .filter((entry) => entry.milestone === "ORDER")
    .reduce((total, entry) => total + entry.percentBasisPoints, 0);
  const preShipmentBps = proposal.paymentSchedule
    .filter((entry) => entry.milestone !== "DELIVERY")
    .reduce((total, entry) => total + entry.percentBasisPoints, 0);
  const within = (value: number, bounds: readonly [number, number]) =>
    value >= bounds[0] && value <= bounds[1];

  if (!within(proposal.leadTimeDays, policy.leadTimeDays))
    return "round-lead-policy";
  if (!within(orderBps, policy.orderPaymentBps)) return "round-payment-policy";
  if (!within(preShipmentBps, policy.preShipmentPaymentBps))
    return "round-payment-policy";

  const baselineByProduct = new Map(
    context.lines.map((line) => [
      line.productId,
      BigInt(line.baselineUnitPriceMinor),
    ]),
  );
  for (const line of proposal.lines) {
    const baseline = baselineByProduct.get(line.productId);
    if (!baseline) return "round-price-policy";
    const price = BigInt(line.unitPriceMinor);
    const minimum = roundMinorByBasisPoints(
      baseline,
      policy.priceMultiplierBasisPoints[0],
    );
    const maximum = roundMinorByBasisPoints(
      baseline,
      policy.priceMultiplierBasisPoints[1],
    );
    if (price < minimum || price > maximum) return "round-price-policy";
  }

  return undefined;
};
export const validateProposal = (
  value: unknown,
  supplier: SupplierId,
  context: NegotiationContext,
  now: Date = new Date(),
): ProposalValidation => {
  const parsed = offerProposalSchema.safeParse(value);
  if (!parsed.success)
    return {
      valid: false,
      reasons: parsed.error.issues.map(
        (issue) => `schema:${issue.path.join(".") || "proposal"}`,
      ),
    };
  const proposal = parsed.data;
  if (proposal.supplierId !== supplier)
    return { valid: false, reasons: ["supplier-identity"] };
  if (proposal.round !== context.round)
    return { valid: false, reasons: ["round-mismatch"] };
  try {
    const intent = buildIntent(context);
    const offer = buildOffer(proposal, context);
    validateOfferAgainstSupplierPolicy(supplier, intent, offer);
    validateOfferCommercialFacts(offer, intent, now);
    const roundViolation = validateRoundPolicy(proposal, context);
    if (roundViolation) return { valid: false, reasons: [roundViolation] };
    const expectedCapacity =
      supplier === "S2" && context.round === 2 ? 60 : 100;
    if (proposal.capacityPercent !== expectedCapacity)
      return { valid: false, reasons: ["capacity-event-mismatch"] };
    return { valid: true, proposal, offer };
  } catch (error) {
    return { valid: false, reasons: [reasonFor(error)] };
  }
};
