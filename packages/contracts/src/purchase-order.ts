import { z } from "zod";
import { idempotencyKeySchema, idSchema, sha256Schema } from "./common.js";
import { paymentScheduleSchema } from "./negotiation-offer.js";
export const purchaseOrderPreviewSchema = z
  .object({ negotiationId: idSchema, selectedOfferId: idSchema })
  .strict();
export const purchaseOrderIssueSchema = purchaseOrderPreviewSchema
  .extend({
    previewDigest: sha256Schema,
    confirmationToken: z.string().min(16),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
export const purchaseOrderCommandSchema = z
  .object({
    negotiationId: idSchema,
    selectedOfferId: idSchema,
    confirmationToken: z.string().min(16).max(4096),
  })
  .strict();
export type PurchaseOrderCommand = z.infer<typeof purchaseOrderCommandSchema>;
export const purchaseOrderPreviewResponseSchema = z
  .object({
    digest: sha256Schema,
    confirmationToken: z.string().min(16),
    totalMinor: z.string().regex(/^\d+$/),
    currency: z.string().length(3),
    supplierId: z.string().min(1),
    lineCount: z.number().int().positive(),
    leadTimeDays: z.number().int().positive(),
    paymentSchedule: paymentScheduleSchema,
  })
  .strict();
export const purchaseOrderResponseSchema = z
  .object({
    id: idSchema,
    number: z.string().min(1),
    replayed: z.boolean(),
  })
  .strict();

export const purchaseOrderListSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: idSchema,
          number: z.string().min(1),
          negotiationId: idSchema,
          supplierId: z.string().min(1),
          totalMinor: z.string().regex(/^\d+$/),
          currency: z.string().length(3),
          issuedAt: z.string().datetime(),
          status: z.literal("ISSUED"),
        })
        .strict(),
    ),
  })
  .strict();

export const purchaseOrderDetailSchema =
  purchaseOrderListSchema.shape.items.element
    .extend({
      supplierId: z.string().min(1),
      leadTimeDays: z.number().int().positive(),
      paymentSchedule: paymentScheduleSchema,
      issuedBy: idSchema,
      lines: z.array(
        z
          .object({
            sku: z.string().min(1),
            name: z.string().nullable(),
            quantity: z.string().regex(/^\d+$/),
            unitPriceMinor: z.string().regex(/^\d+$/),
            extendedTotalMinor: z.string().regex(/^\d+$/),
          })
          .strict(),
      ),
      audit: z.array(
        z
          .object({
            type: z.string().min(1),
            actorId: idSchema,
            at: z.string().datetime(),
          })
          .strict(),
      ),
    })
    .strict();
