import { DomainInvariantError } from "./errors.js";
import { roundMinorByBasisPoints } from "./money.js";
import type { Offer } from "./offer.js";
import type { OrderIntent } from "./order-intent.js";
import { preShipmentBurden } from "./payment.js";
export type SupplierId = "S1" | "S2" | "S3";
export type SupplierPolicy = Readonly<{
  supplierId: SupplierId;
  quality: number;
  priceMultiplierBasisPoints: readonly [number, number];
  leadTimeDays: readonly [number, number];
  orderPaymentBps: readonly [number, number];
  preShipmentPaymentBps: readonly [number, number];
  capacityPercent: number;
}>;

export type SupplierRoundPolicy = Readonly<{
  priceMultiplierBasisPoints: readonly [number, number];
  leadTimeDays: readonly [number, number];
  orderPaymentBps: readonly [number, number];
  preShipmentPaymentBps: readonly [number, number];
}>;

/**
 * Round one reproduces the supplier facts from the challenge. Round two is the
 * supplier's bounded concession space, so every accepted response is a real
 * improvement over its opening position rather than an unrelated reroll.
 */
export const SUPPLIER_ROUND_POLICY_V1: Readonly<
  Record<SupplierId, Readonly<Record<1 | 2, SupplierRoundPolicy>>>
> = {
  S1: {
    1: {
      priceMultiplierBasisPoints: [10_000, 10_000],
      leadTimeDays: [50, 50],
      orderPaymentBps: [3_300, 3_300],
      preShipmentPaymentBps: [6_600, 6_600],
    },
    2: {
      priceMultiplierBasisPoints: [9_200, 9_900],
      leadTimeDays: [42, 49],
      orderPaymentBps: [2_000, 3_200],
      preShipmentPaymentBps: [6_000, 6_500],
    },
  },
  S2: {
    1: {
      priceMultiplierBasisPoints: [11_500, 11_500],
      leadTimeDays: [25, 25],
      orderPaymentBps: [4_000, 4_000],
      preShipmentPaymentBps: [4_000, 4_000],
    },
    2: {
      priceMultiplierBasisPoints: [10_500, 11_400],
      leadTimeDays: [20, 24],
      orderPaymentBps: [3_000, 3_900],
      preShipmentPaymentBps: [3_000, 3_900],
    },
  },
  S3: {
    1: {
      priceMultiplierBasisPoints: [10_500, 10_500],
      leadTimeDays: [15, 15],
      orderPaymentBps: [10_000, 10_000],
      preShipmentPaymentBps: [10_000, 10_000],
    },
    2: {
      priceMultiplierBasisPoints: [9_700, 10_400],
      leadTimeDays: [12, 14],
      orderPaymentBps: [7_000, 9_900],
      preShipmentPaymentBps: [7_000, 9_900],
    },
  },
};
export const SUPPLIER_POLICY_V1: Readonly<Record<SupplierId, SupplierPolicy>> =
  {
    S1: {
      supplierId: "S1",
      quality: 4,
      priceMultiplierBasisPoints: [9200, 10000],
      leadTimeDays: [42, 55],
      orderPaymentBps: [2000, 3300],
      preShipmentPaymentBps: [6000, 6600],
      capacityPercent: 100,
    },
    S2: {
      supplierId: "S2",
      quality: 4.7,
      priceMultiplierBasisPoints: [10500, 11500],
      leadTimeDays: [20, 30],
      orderPaymentBps: [3000, 4000],
      preShipmentPaymentBps: [3000, 4000],
      capacityPercent: 100,
    },
    S3: {
      supplierId: "S3",
      quality: 4,
      priceMultiplierBasisPoints: [9700, 10800],
      leadTimeDays: [12, 20],
      orderPaymentBps: [7000, 10000],
      preShipmentPaymentBps: [7000, 10000],
      capacityPercent: 100,
    },
  };
export const validateOfferAgainstSupplierPolicy = (
  supplierId: SupplierId,
  intent: OrderIntent,
  offer: Offer,
): void => {
  const policy = SUPPLIER_POLICY_V1[supplierId];
  if (offer.supplierId !== supplierId)
    throw new DomainInvariantError(
      "supplier-identity",
      "Offer supplier identity is immutable",
    );
  if (
    offer.leadTimeDays < policy.leadTimeDays[0] ||
    offer.leadTimeDays > policy.leadTimeDays[1]
  )
    throw new DomainInvariantError(
      "lead-policy",
      "Lead time is outside supplier policy",
    );
  const orderBps = offer.paymentSchedule
    .filter((payment) => payment.milestone === "ORDER")
    .reduce((sum, payment) => sum + payment.percentBasisPoints, 0);
  const preShipmentBps = preShipmentBurden(offer.paymentSchedule);

  if (
    orderBps < policy.orderPaymentBps[0] ||
    orderBps > policy.orderPaymentBps[1] ||
    preShipmentBps < policy.preShipmentPaymentBps[0] ||
    preShipmentBps > policy.preShipmentPaymentBps[1]
  )
    throw new DomainInvariantError(
      "payment-policy",
      "Payment schedule is outside supplier policy",
    );
  const sources = new Map(
    intent.lines.map((line) => [line.productId, line.baselineUnitPrice]),
  );
  if (offer.lines.length !== sources.size)
    throw new DomainInvariantError(
      "price-coverage",
      "Policy checks require one baseline price per offer line",
    );
  const seen = new Set<string>();
  for (const line of offer.lines) {
    const source = sources.get(line.productId);
    if (seen.has(line.productId))
      throw new DomainInvariantError(
        "price-coverage",
        "Policy checks require unique offer products",
      );
    if (!source || source.currency !== line.unitPrice.currency)
      throw new DomainInvariantError(
        "price-currency",
        "Policy prices must use the source currency",
      );
    const [minimum, maximum] = policy.priceMultiplierBasisPoints;
    const minimumMinor = roundMinorByBasisPoints(source.minor, minimum);
    const maximumMinor = roundMinorByBasisPoints(source.minor, maximum);
    if (
      line.unitPrice.minor < minimumMinor ||
      line.unitPrice.minor > maximumMinor
    )
      throw new DomainInvariantError(
        "price-policy",
        "Line price is outside supplier policy",
      );
    seen.add(line.productId);
  }
};
