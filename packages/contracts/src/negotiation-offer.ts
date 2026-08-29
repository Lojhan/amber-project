import { z } from "zod";
import { currencySchema, idSchema } from "./common.js";
export const paymentMilestoneSchema = z.enum([
  "ORDER",
  "PRE_SHIPMENT",
  "DELIVERY",
]);
export const paymentInstallmentSchema = z
  .object({
    milestone: paymentMilestoneSchema,
    percentBasisPoints: z.number().int().min(0).max(10_000),
  })
  .strict();
export const paymentScheduleSchema = z
  .array(paymentInstallmentSchema)
  .min(1)
  .superRefine((entries, ctx) => {
    if (
      entries.reduce((sum, entry) => sum + entry.percentBasisPoints, 0) !==
      10_000
    )
      ctx.addIssue({
        code: "custom",
        message: "Payment schedule must total 10,000 basis points",
      });
  });
export const offerProposalSchema = z
  .object({
    supplierId: z.enum(["S1", "S2", "S3"]),
    round: z.union([z.literal(1), z.literal(2)]),
    message: z.string().trim().min(10).max(1_000),
    currency: currencySchema,
    leadTimeDays: z.number().int().positive(),
    capacityPercent: z.number().int().min(0).max(100),
    expiresAt: z.string().datetime(),
    paymentSchedule: paymentScheduleSchema,
    lines: z
      .array(
        z
          .object({
            productId: idSchema,
            quantity: z.string().regex(/^\d+$/),
            unitPriceMinor: z.string().regex(/^\d+$/),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type OfferProposal = z.infer<typeof offerProposalSchema>;
