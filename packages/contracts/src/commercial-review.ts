import { z } from "zod";
import { idSchema } from "./common.js";

const maximumQuantity = 9_223_372_036_854_775_807n;

export const requestedQuantitySchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Quantity must be a positive whole number")
  .refine((value) => BigInt(value) <= maximumQuantity, "Quantity is too large");

export const commercialReviewSchema = z
  .object({
    quotationId: idSchema,
    scenarioId: idSchema,
    lines: z
      .array(
        z
          .object({
            parsedLineId: idSchema,
            requestedQuantity: requestedQuantitySchema,
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict()
  .superRefine((value, context) => {
    const lineIds = value.lines.map((line) => line.parsedLineId);
    if (new Set(lineIds).size !== lineIds.length)
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Each quotation line may only appear once",
      });
  });

export const commercialReviewResponseSchema = z
  .object({ quotationId: idSchema })
  .strict();
