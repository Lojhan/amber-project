import { z } from "zod";

export const eventsQuerySchema = z
  .object({ once: z.enum(["true", "false"]).optional() })
  .strict();
export const eventSchema = z
  .object({
    id: z.string().min(1),
    aggregateId: z.string().min(1),
    type: z.string().min(1),
    version: z.number().int().nonnegative(),
    payload: z.unknown(),
  })
  .passthrough();
export const eventBatchSchema = z.array(eventSchema);
