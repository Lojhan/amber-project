import { z } from "zod";
import { idSchema } from "./common.js";
export const hardConstraintsSchema = z
  .object({ maxLeadTimeDays: z.number().int().positive().max(365).optional() })
  .strict();

export const matchResolutionSchema = z
  .object({
    quotationId: z.uuid(),
    scenarioId: z.uuid(),
    matchId: z.uuid(),
    action: z.enum(["accept", "select", "exclude"]),
    selectedProductId: z.uuid().optional(),
    rationale: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict();

export const matchResolutionResponseSchema = z
  .object({ quotationId: idSchema })
  .strict();

export const scenarioSelectionSchema = z
  .object({ quotationId: idSchema, scenarioId: idSchema })
  .strict();

export const scenarioSelectionResponseSchema = scenarioSelectionSchema;
