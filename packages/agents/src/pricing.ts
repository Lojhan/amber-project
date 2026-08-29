import { type Brand, roundMinorByBasisPoints } from "@procurement/domain";

export type BasisPoints = Brand<number, "BasisPoints">;
export type MinorAmount = Brand<bigint, "MinorAmount">;
export const asBasisPoints = (value: number): BasisPoints => {
  if (!Number.isInteger(value) || value < 0 || value > 100_000)
    throw new RangeError(
      "Basis points must be an integer between 0 and 100,000",
    );
  return value as BasisPoints;
};

export const asMinorAmount = (value: bigint): MinorAmount => {
  if (value < 0n) throw new RangeError("Minor amount cannot be negative");
  return value as MinorAmount;
};
/** Multiplies by basis points (10,000 = 100%) and rounds halves upward. */
export const roundHalfUpBasisPoints = (
  amount: MinorAmount,
  multiplier: BasisPoints,
): bigint => roundMinorByBasisPoints(amount, multiplier);
