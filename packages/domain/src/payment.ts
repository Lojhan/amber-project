import { DomainInvariantError } from "./errors.js";
export type PaymentMilestone = "ORDER" | "PRE_SHIPMENT" | "DELIVERY";
export type PaymentInstallment = Readonly<{
  milestone: PaymentMilestone;
  percentBasisPoints: number;
}>;
export const validatePaymentSchedule = (
  schedule: readonly PaymentInstallment[],
): void => {
  if (schedule.length === 0)
    throw new DomainInvariantError(
      "payment-required",
      "Payment schedule is required",
    );
  const total = schedule.reduce((sum, entry) => {
    if (
      !Number.isInteger(entry.percentBasisPoints) ||
      entry.percentBasisPoints < 0
    )
      throw new DomainInvariantError(
        "payment-percent",
        "Payment percent must be a non-negative integer",
      );
    return sum + entry.percentBasisPoints;
  }, 0);
  if (total !== 10_000)
    throw new DomainInvariantError(
      "payment-total",
      "Payment schedule must total 100%",
    );
};

export const preShipmentBurden = (
  schedule: readonly PaymentInstallment[],
): number => {
  validatePaymentSchedule(schedule);
  return schedule
    .filter((entry) => entry.milestone !== "DELIVERY")
    .reduce((sum, entry) => sum + entry.percentBasisPoints, 0);
};
