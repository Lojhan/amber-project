import { z } from "zod";
import { idSchema } from "./common.js";

export const negotiationPolicyPreviewRequestSchema = z
  .object({ quotationId: idSchema, scenarioId: idSchema })
  .strict();

export const negotiationStartSchema = z
  .object({
    quotationId: idSchema,
    scenarioId: idSchema,
    policyHash: z.string().regex(/^[a-f0-9]{64}$/),
    confirmationToken: z.string().min(16).max(8_192),
  })
  .strict();

export const negotiationPolicyPreviewSchema = z
  .object({
    quotationId: idSchema,
    scenarioId: idSchema,
    policyVersion: z.string().min(1),
    policyHash: z.string().regex(/^[a-f0-9]{64}$/),
    weights: z
      .object({
        cost: z.string().regex(/^0\.\d+$/),
        quality: z.string().regex(/^0\.\d+$/),
        lead: z.string().regex(/^0\.\d+$/),
        payment: z.string().regex(/^0\.\d+$/),
      })
      .strict(),
    constraints: z
      .object({ hardMaxLead: z.number().int().positive().optional() })
      .strict(),
    interpretation: z
      .object({
        primaryPriority: z
          .enum(["cost", "quality", "lead_time", "payment_terms"])
          .nullable(),
        summary: z.string().min(1),
        warnings: z.array(z.string()),
        source: z.enum(["ai", "default"]),
      })
      .strict(),
    confirmationToken: z.string().min(16),
  })
  .strict();

export const negotiationProjectionSchema = z
  .object({
    id: idSchema,
    status: z.string().min(1),
    timeline: z.array(
      z
        .object({
          actor: z.enum(["brand", "supplier", "system"]),
          supplierId: z.string().optional(),
          round: z.number().int().positive().optional(),
          status: z.string().optional(),
          detail: z.string().optional(),
        })
        .strict(),
    ),
    reducedCompetition: z.boolean(),
    offers: z.array(
      z
        .object({
          id: idSchema,
          supplierId: z.string().min(1),
          round: z.number().int().positive(),
          leadTimeDays: z.number().int().positive(),
          capacityPercent: z.number().int().min(1).max(100),
          fullOrderEligible: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
