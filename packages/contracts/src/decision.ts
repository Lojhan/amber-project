import { z } from "zod";
import { idSchema } from "./common.js";

const decimalSchema = z.string().regex(/^-?\d+(\.\d+)?$/);
const weightsSchema = z
  .object({
    cost: decimalSchema,
    quality: decimalSchema,
    lead: decimalSchema,
    payment: decimalSchema,
  })
  .strict();
const offerEvaluationSchema = z
  .object({
    candidate: z
      .object({
        offerId: idSchema,
        supplierId: z.enum(["S1", "S2", "S3"]),
        totalMinor: decimalSchema,
        quality: z.number(),
        leadTimeDays: z.number().int().positive(),
        preShipmentBps: z.number().int(),
        policyValid: z.boolean(),
        currency: z.string().length(3),
        capacityPercent: z.number().int().min(1).max(100),
      })
      .strict(),
    offerId: idSchema,
    eligible: z.boolean(),
    exclusionReasons: z.array(z.string()),
    totalMinor: decimalSchema,
    quality: decimalSchema,
    leadTimeDays: z.number().int().positive(),
    preShipmentBps: z.number().int(),
    normalized: z
      .object({
        cost: decimalSchema,
        quality: decimalSchema,
        lead: decimalSchema,
        payment: decimalSchema,
      })
      .strict()
      .optional(),
    score: decimalSchema.optional(),
    paretoStatus: z.enum(["dominated", "non_dominated"]).optional(),
  })
  .strict();
export const decisionRequestSchema = z
  .object({ negotiationId: idSchema })
  .strict();

export const decisionProjectionSchema = z
  .object({
    id: idSchema,
    negotiationId: idSchema,
    winnerOfferId: idSchema.nullable(),
    decisionRecord: z
      .object({
        policyVersion: z.string(),
        policyHash: z.string(),
        decisionVersion: z.string(),
        inputs: z
          .object({
            baselineMinor: z.string(),
            currency: z.string(),
            hardMaxLead: z.number().optional(),
          })
          .strict(),
        policySnapshot: z
          .object({
            version: z.string(),
            hash: z.string(),
            weights: weightsSchema,
            hardMaxLead: z.number().int().positive().optional(),
            derivedFrom: z
              .object({
                version: z.string(),
                hash: z.string(),
                noteConstraintIds: z.array(z.string()),
              })
              .strict()
              .optional(),
          })
          .strict(),
        anchors: z
          .object({
            cost: z
              .object({
                best: z.literal("0.92*baseline"),
                worst: z.literal("1.15*baseline"),
                bestMinor: decimalSchema,
                worstMinor: decimalSchema,
              })
              .strict(),
            quality: z
              .object({ best: decimalSchema, worst: decimalSchema })
              .strict(),
            lead: z
              .object({ best: decimalSchema, worst: decimalSchema })
              .strict(),
            payment: z
              .object({ best: decimalSchema, worst: decimalSchema })
              .strict(),
          })
          .strict(),
        valueFunctions: z
          .object({
            cost: z.string(),
            quality: z.string(),
            lead: z.string(),
            payment: z.string(),
          })
          .strict(),
        weights: weightsSchema,
        offers: z.array(offerEvaluationSchema),
        paretoOfferIds: z.array(idSchema),
        sensitivity: z.array(
          z
            .object({
              criterion: z.string(),
              direction: z.string(),
              weights: weightsSchema,
              winnerOfferId: idSchema.optional(),
              recommendationStatus: z.string(),
            })
            .strict(),
        ),
        preferenceSensitive: z.boolean(),
        winnerOfferId: idSchema.optional(),
        recommendationStatus: z.string(),
        tieBreakTrace: z.array(z.string()),
        warnings: z.array(z.string()),
        rationale: z.string(),
      })
      .strict(),
  })
  .strict();

export const decisionProjectionResponseSchema =
  decisionProjectionSchema.nullable();
