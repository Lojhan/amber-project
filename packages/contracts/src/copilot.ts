import { z } from "zod";
import { requestedQuantitySchema } from "./commercial-review.js";
import { idSchema } from "./common.js";

const suggestionBase = {
  title: z.string().trim().min(1).max(120),
  explanation: z.string().trim().min(1).max(500),
};

export const quoteCopilotSuggestionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...suggestionBase,
      kind: z.literal("select_scenario"),
      scenarioId: idSchema,
    })
    .strict(),
  z
    .object({
      ...suggestionBase,
      kind: z.literal("include_line"),
      matchId: idSchema,
      productId: idSchema,
    })
    .strict(),
  z
    .object({
      ...suggestionBase,
      kind: z.literal("exclude_line"),
      matchId: idSchema,
    })
    .strict(),
  z
    .object({
      ...suggestionBase,
      kind: z.literal("set_quantity"),
      lineId: idSchema,
      quantity: requestedQuantitySchema,
    })
    .strict(),
]);

export const quoteCopilotMessageSchema = z
  .object({
    id: idSchema,
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4_000),
    suggestions: z.array(quoteCopilotSuggestionSchema).max(3),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const quoteCopilotConversationSchema = z
  .object({
    quotationId: idSchema,
    messages: z.array(quoteCopilotMessageSchema).max(100),
  })
  .strict();

export const quoteCopilotRequestSchema = z
  .object({
    quotationId: idSchema,
    message: z.string().trim().min(1).max(2_000),
  })
  .strict();

export type QuoteCopilotSuggestion = z.infer<
  typeof quoteCopilotSuggestionSchema
>;
