import { z } from "zod";
import { idempotencyKeySchema, idSchema, sha256Schema } from "./common.js";
export const quotationUploadCommandSchema = z
  .object({
    filename: z.string().min(1).max(255),
    contentHash: sha256Schema,
    note: z.string().max(2000).optional(),
  })
  .strict();

export const quotationUploadReservationSchema = z
  .object({
    objectKey: z.string().min(1),
    uploadUrl: z.url(),
    uploadMethod: z.literal("PUT"),
    headers: z
      .object({
        "content-type": z.literal(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
        "x-amz-meta-sha256": sha256Schema,
      })
      .strict(),
  })
  .strict();

export const quotationUploadCompleteSchema = z
  .object({
    objectKey: z.string().min(1),
    contentHash: sha256Schema,
    note: z.string().max(2000).optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const quotationUploadCompletionSchema = z
  .object({
    id: idSchema,
    state: z.string().min(1),
    replayed: z.boolean(),
  })
  .strict();

export const quotationProjectionSchema = z
  .object({
    id: idSchema,
    status: z.string().min(1),
    currency: z.string().length(3).optional(),
    selectedScenarioId: idSchema.optional(),
    negotiationId: idSchema.optional(),
    scenarios: z.array(
      z
        .object({
          id: idSchema,
          label: z.string().min(1),
          evidence: z.string().optional(),
        })
        .strict(),
    ),
    matches: z.array(
      z
        .object({
          id: idSchema,
          lineId: idSchema,
          scenarioId: idSchema,
          label: z.string().min(1),
          matchReady: z.boolean(),
          status: z.string().optional(),
          selectedProductId: idSchema.optional(),
          requestedQuantity: z
            .string()
            .regex(/^[1-9]\d*$/)
            .optional(),
          unitPriceMinor: z.string().regex(/^\d+$/).optional(),
          extendedTotalMinor: z.string().regex(/^\d+$/).optional(),
          sourceReference: z.string().min(1).optional(),
          minimumOrderQuantity: z
            .string()
            .regex(/^[1-9]\d*$/)
            .optional(),
          reviewReasons: z.array(
            z.enum([
              "missing_requested_quantity",
              "no_price_for_requested_quantity",
              "missing_unit_price",
              "ambiguous_commercial_fields",
            ]),
          ),
          candidates: z.array(
            z
              .object({
                productId: idSchema,
                sku: z.string().min(1),
                name: z.string().min(1).optional(),
                score: z.number().min(0).max(1),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();
