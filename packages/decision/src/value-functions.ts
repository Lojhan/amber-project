import { Decimal } from "decimal.js";
import type { Criterion, NormalizedValues } from "./types.js";

export const VALUE_FUNCTION_IDENTIFIERS: Readonly<Record<Criterion, string>> = {
  cost: "clamp((1.15*baseline-total)/(0.23*baseline), 0, 1)",
  quality: "clamp((quality-4.0)/0.7, 0, 1)",
  lead: "clamp((55-lead-days)/43, 0, 1)",
  payment: "clamp((10000-pre-shipment-bps)/7000, 0, 1)",
};
const clamp = (value: Decimal): Decimal =>
  Decimal.max(0, Decimal.min(1, value));
export const normalizedValues = (
  candidate: {
    totalMinor: bigint;
    quality: number;
    leadTimeDays: number;
    preShipmentBps: number;
  },
  baselineMinor: bigint,
): Record<Criterion, Decimal> => {
  const baseline = new Decimal(baselineMinor.toString());
  return {
    cost: clamp(
      new Decimal("1.15")
        .mul(baseline)
        .sub(candidate.totalMinor.toString())
        .div(new Decimal("0.23").mul(baseline)),
    ),
    quality: clamp(new Decimal(candidate.quality).sub(4).div("0.7")),
    lead: clamp(new Decimal(55).sub(candidate.leadTimeDays).div(43)),
    payment: clamp(
      new Decimal(10_000).sub(candidate.preShipmentBps).div(7_000),
    ),
  };
};

export const serializeValues = (
  values: Record<Criterion, Decimal>,
): NormalizedValues => ({
  cost: values.cost.toFixed(12),
  quality: values.quality.toFixed(12),
  lead: values.lead.toFixed(12),
  payment: values.payment.toFixed(12),
});
