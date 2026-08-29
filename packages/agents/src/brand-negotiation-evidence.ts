import type { BrandNegotiationContext } from "@procurement/application/ports";
import { displayMinorUnits } from "./money-display.js";

const baselineLineEvidence = (
  context: BrandNegotiationContext,
  line: BrandNegotiationContext["lines"][number],
) => {
  const quantity = line.quantity.toString();
  const unitPriceMinor = line.baselineUnitPriceMinor.toString();
  const extendedTotalMinor = (
    line.quantity * line.baselineUnitPriceMinor
  ).toString();

  return {
    productId: line.productId,
    quantity,
    baselineUnitPriceMinor: unitPriceMinor,
    baselineUnitPriceDisplay: displayMinorUnits(
      unitPriceMinor,
      context.currency,
    ),
    extendedTotalMinor,
    extendedTotalDisplay: displayMinorUnits(
      extendedTotalMinor,
      context.currency,
    ),
  };
};

export const commercialBaselineEvidence = (
  context: BrandNegotiationContext,
) => {
  const totalMinor = context.lines
    .reduce(
      (total, line) => total + line.quantity * line.baselineUnitPriceMinor,
      0n,
    )
    .toString();

  return {
    currency: context.currency,
    totalMinor,
    totalDisplay: displayMinorUnits(totalMinor, context.currency),
    lines: context.lines.map((line) => baselineLineEvidence(context, line)),
  };
};

export const conversationEvidence = (context: BrandNegotiationContext) =>
  context.priorConversation.map((entry) => ({
    ...entry,
    ...(entry.commercialTerms
      ? {
          commercialTerms: {
            ...entry.commercialTerms,
            totalDisplay: displayMinorUnits(
              entry.commercialTerms.totalMinor,
              context.currency,
            ),
          },
        }
      : {}),
  }));
