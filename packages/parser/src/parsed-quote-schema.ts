import { z } from "zod";
import type { ParsedQuote } from "./types.js";

const text = z.string().max(4096);
const raw = z.union([text, z.number().finite(), z.boolean(), z.null()]);
const evidence = z
  .object({
    sheet: text,
    address: text,
    displayed: text.nullable(),
    raw,
    formula: text.optional(),
    numberFormat: text.optional(),
    mergedFrom: text.optional(),
  })
  .strict();
const warning = z
  .object({
    code: text,
    message: text,
    evidence: z.array(evidence).max(100).optional(),
  })
  .strict();
const field = <T extends z.ZodType>(value: T) =>
  z
    .object({
      value,
      evidence: z.array(evidence).max(100),
      confidence: z.number().finite().min(0).max(1),
    })
    .strict();
const region = z
  .object({
    sheet: text,
    startRow: z.number().int().positive(),
    endRow: z.number().int().positive(),
    startColumn: z.number().int().positive(),
    endColumn: z.number().int().positive(),
  })
  .strict()
  .refine(
    (value) =>
      value.startRow <= value.endRow && value.startColumn <= value.endColumn,
  );
const line = z
  .object({
    evidence: z.array(evidence).max(100),
    sku: field(text).optional(),
    description: field(text).optional(),
    quantityCandidates: z.array(field(text)).max(100),
    unitPriceCandidates: z.array(field(text)).max(100),
    lineTotal: field(text).optional(),
    tiers: z
      .array(
        z
          .object({
            minimumQuantity: z.number().finite().nonnegative().optional(),
            unitPrice: field(text),
          })
          .strict(),
      )
      .max(100),
    fieldRoleStatus: z.enum(["resolved", "ambiguous"]),
    confidence: z.number().finite().min(0).max(1),
    warnings: z.array(warning).max(100),
  })
  .strict();
const scenario = z
  .object({
    id: text,
    sourceRegions: z.array(region).max(100),
    label: text.optional(),
    metadata: z.record(text, field(text)),
    lines: z.array(line).max(10_000),
    groupingReasons: z.array(warning).max(100),
    confidence: z.number().finite().min(0).max(1),
  })
  .strict();
const sheet = z
  .object({
    name: text,
    state: z.enum(["visible", "hidden", "veryHidden"]),
    usedRange: text.optional(),
    mergedRegions: z.array(text).max(10_000),
    tables: z.array(text).max(10_000),
    relationships: z.array(text).max(10_000),
  })
  .strict();

const schema = z
  .object({
    parserVersion: text,
    scenarios: z.array(scenario).max(100),
    warnings: z.array(warning).max(1000),
    sheets: z.array(sheet).max(100),
  })
  .strict();

export const parseIsolatedParsedQuote = (value: unknown): ParsedQuote =>
  schema.parse(value) as ParsedQuote;
