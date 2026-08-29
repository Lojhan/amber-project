import { DomainInvariantError } from "./errors.js";
import type { OfferId, ProductId } from "./ids.js";
import type { CurrencyCode, Money } from "./money.js";
import { type OrderIntent, validateOrderIntent } from "./order-intent.js";
import { type PaymentInstallment, validatePaymentSchedule } from "./payment.js";
import type { SupplierId } from "./supplier-policy.js";
export type OfferLine = Readonly<{
  productId: ProductId;
  unitPrice: Money;
  quantity: bigint;
}>;
export type Offer = Readonly<{
  id: OfferId;
  supplierId: SupplierId;
  currency: CurrencyCode;
  leadTimeDays: number;
  capacityPercent: number;
  expiresAt: Date;
  lines: readonly OfferLine[];
  paymentSchedule: readonly PaymentInstallment[];
  policyValid: boolean;
}>;
export const validateOfferCommercialFacts = (
  offer: Offer,
  intent: OrderIntent,
  now: Date,
): void => {
  validateOrderIntent(intent);
  validatePaymentSchedule(offer.paymentSchedule);

  if (!offer.policyValid)
    throw new DomainInvariantError(
      "offer-policy",
      "Offer failed policy validation",
    );
  if (offer.currency !== intent.currency)
    throw new DomainInvariantError(
      "offer-currency",
      "Offer currency must match order",
    );
  if (offer.expiresAt <= now)
    throw new DomainInvariantError("offer-expired", "Offer has expired");
  const expected = new Map(intent.lines.map((line) => [line.productId, line]));
  if (offer.lines.length !== expected.size)
    throw new DomainInvariantError(
      "offer-complete",
      "Offer must cover every order line",
    );
  const seen = new Set<string>();
  for (const line of offer.lines) {
    const expectedLine = expected.get(line.productId);
    if (seen.has(line.productId))
      throw new DomainInvariantError(
        "offer-product-unique",
        "Offer may contain each product only once",
      );
    if (
      !expectedLine ||
      line.quantity !== expectedLine.quantity ||
      line.unitPrice.currency !== intent.currency ||
      line.unitPrice.minor <= 0n
    )
      throw new DomainInvariantError(
        "offer-complete",
        "Offer lines must exactly cover order intent with positive prices",
      );
    seen.add(line.productId);
  }
};

export const validateOfferForIntent = (
  offer: Offer,
  intent: OrderIntent,
  now: Date,
): void => {
  validateOfferCommercialFacts(offer, intent, now);
  if (offer.capacityPercent !== 100)
    throw new DomainInvariantError(
      "offer-capacity",
      "Offer cannot fulfil the full order",
    );
};

export const applyCapacityEvent = (
  supplierId: SupplierId,
  currentCapacity: number,
): number => {
  if (supplierId !== "S2")
    throw new DomainInvariantError(
      "capacity-supplier",
      "Only S2 has the required capacity event",
    );
  if (currentCapacity !== 100)
    throw new DomainInvariantError(
      "capacity-once",
      "Capacity event may be applied once",
    );
  return 60;
};
