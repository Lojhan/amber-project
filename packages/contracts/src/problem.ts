import { z } from "zod";
export const problemSchema = z
  .object({
    type: z.string().url(),
    title: z.string(),
    status: z.number().int().min(400).max(599),
    detail: z.string(),
    instance: z.string().optional(),
    /** Stable, machine-readable application error identifier. */
    code: z.string().min(1),
    /** Request correlation identifier, safe to give to support. */
    correlationId: z.string().min(1),
    /** Field-path to validation message map for invalid requests. */
    fields: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export type Problem = z.infer<typeof problemSchema>;
