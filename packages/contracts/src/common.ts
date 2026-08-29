import { z } from "zod";
export const idSchema = z.string().min(1).max(128);
export const brandKeySchema = z.string().regex(/^[a-z][a-z0-9-]*$/);
export const currencySchema = z.enum(["USD", "EUR", "BRL"]);
export const moneySchema = z
  .object({ currency: currencySchema, minor: z.string().regex(/^\d+$/) })
  .strict();
export const idempotencyKeySchema = z.string().min(1).max(255);
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const idParamsSchema = z.object({ id: idSchema }).strict();
export const negotiationParamsSchema = z
  .object({ negotiationId: idSchema })
  .strict();
export const emptyObjectSchema = z.object({}).strict();
export const okResponseSchema = z.object({ ok: z.literal(true) }).strict();
/** JSON projection boundary for service-owned read models. */
export const projectionSchema = z.object({}).passthrough();
