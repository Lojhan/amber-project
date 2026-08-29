import { DomainInvariantError } from "./errors.js";

export type CurrencyCode = "USD" | "EUR" | "BRL";
export type Money = Readonly<{ currency: CurrencyCode; minor: bigint }>;
export const money = (currency: CurrencyCode, minor: bigint): Money => {
  if (minor < 0n)
    throw new DomainInvariantError(
      "money-negative",
      "Money cannot be negative",
    );
  return { currency, minor };
};

export const addMoney = (left: Money, right: Money): Money => {
  if (left.currency !== right.currency)
    throw new DomainInvariantError("currency-match", "Currencies must match");
  return money(left.currency, left.minor + right.minor);
};

export const multiplyMoney = (unit: Money, quantity: bigint): Money => {
  if (quantity <= 0n)
    throw new DomainInvariantError(
      "quantity-positive",
      "Quantity must be positive",
    );
  return money(unit.currency, unit.minor * quantity);
};

/** Applies a basis-point multiplier and rounds fractional minor units half up. */
export const roundMinorByBasisPoints = (
  minor: bigint,
  basisPoints: number,
): bigint => {
  if (minor < 0n)
    throw new DomainInvariantError(
      "money-negative",
      "Money cannot be negative",
    );
  if (!Number.isInteger(basisPoints) || basisPoints < 0)
    throw new DomainInvariantError(
      "basis-points-invalid",
      "Basis points must be a non-negative integer",
    );

  return (minor * BigInt(basisPoints) + 5_000n) / 10_000n;
};
