import type { OfferProposal } from "@procurement/contracts";
import {
  hashEvidence,
  MODEL_CONFIGURATION,
  requestContext,
  SYSTEM_PROMPT,
  structuredOfferFormat,
} from "./model-configuration.js";
import { proposalRepairFeedback } from "./proposal-repair.js";
import { validateProposal } from "./proposal-validation.js";
import type {
  ModelResult,
  NegotiationContext,
  NegotiationModel,
  ParsedResponse,
  RequestMetadata,
  ResponsesClient,
  SupplierId,
} from "./types.js";

type AttemptFailure = Readonly<{
  status: "refused" | "invalid";
  violations: readonly string[];
}>;

type AttemptOutcome =
  | Readonly<{ status: "proposal"; proposal: OfferProposal }>
  | AttemptFailure;

const usageOf = (response: ParsedResponse) => {
  if (!response.usage || typeof response.usage !== "object") return {};
  const usage = response.usage as Record<string, unknown>;

  return {
    ...(typeof usage.input_tokens === "number"
      ? { inputTokens: usage.input_tokens }
      : {}),
    ...(typeof usage.output_tokens === "number"
      ? { outputTokens: usage.output_tokens }
      : {}),
    ...(typeof usage.total_tokens === "number"
      ? { totalTokens: usage.total_tokens }
      : {}),
  };
};

const aggregateUsage = (responses: readonly ParsedResponse[]) => {
  const usages = responses.map(usageOf);
  const sum = (key: "inputTokens" | "outputTokens" | "totalTokens") => {
    const values = usages.flatMap((usage) =>
      usage[key] === undefined ? [] : [usage[key]],
    );

    return values.length
      ? values.reduce((total, value) => total + value, 0)
      : undefined;
  };

  const inputTokens = sum("inputTokens");
  const outputTokens = sum("outputTokens");
  const totalTokens = sum("totalTokens");

  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens }),
  };
};

const metadataFor = (
  startedAt: number,
  contextHash: string,
  responses: readonly ParsedResponse[],
  validationFailures: readonly string[],
): RequestMetadata => {
  const requestIds = responses.flatMap((response) =>
    response.id ? [response.id] : [],
  );

  return {
    requestId: requestIds.at(-1) ?? null,
    requestIds,
    attemptCount: responses.length,
    validationFailures,
    modelId: MODEL_CONFIGURATION.modelId,
    reasoningEffort: "medium",
    promptVersion: MODEL_CONFIGURATION.promptVersion,
    promptHash: MODEL_CONFIGURATION.promptHash,
    schemaVersion: MODEL_CONFIGURATION.schemaVersion,
    schemaHash: MODEL_CONFIGURATION.schemaHash,
    policyVersion: MODEL_CONFIGURATION.policyVersion,
    policyHash: MODEL_CONFIGURATION.policyHash,
    contextVersion: MODEL_CONFIGURATION.contextVersion,
    contextHash,
    latencyMs: Date.now() - startedAt,
    tokenUsage: aggregateUsage(responses),
  };
};

const outcomeOf = (
  response: ParsedResponse,
  supplier: SupplierId,
  context: NegotiationContext,
): AttemptOutcome => {
  if (response.status === "incomplete")
    return { status: "invalid", violations: ["incomplete_response"] };
  if (response.output_parsed === undefined)
    return {
      status: "refused",
      violations: ["model_refusal_or_empty_output"],
    };
  const validation = validateProposal(
    response.output_parsed,
    supplier,
    context,
  );

  return validation.valid
    ? { status: "proposal", proposal: validation.proposal }
    : { status: "invalid", violations: validation.reasons };
};

export const buildOpenAIRequest = (
  supplier: SupplierId,
  context: NegotiationContext,
  repair?: ReturnType<typeof proposalRepairFeedback>,
): unknown => ({
  model: MODEL_CONFIGURATION.modelId,
  reasoning: { effort: "medium" },
  input: [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify(requestContext(supplier, context, repair)),
    },
  ],
  text: { format: structuredOfferFormat() },
});

export class OpenAINegotiationModel implements NegotiationModel {
  constructor(
    private readonly client: ResponsesClient,
    private readonly timeoutMs = 30_000,
    private readonly maxValidationAttempts = 2,
  ) {}

  async propose(
    supplier: SupplierId,
    context: NegotiationContext,
  ): Promise<ModelResult> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const contextHash = hashEvidence(requestContext(supplier, context));
    const responses: ParsedResponse[] = [];
    const failures: string[] = [];
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let lastFailure: AttemptFailure = {
        status: "invalid",
        violations: ["validation_not_attempted"],
      };
      const attempts = Math.max(1, this.maxValidationAttempts);

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const repair =
          attempt === 1
            ? undefined
            : proposalRepairFeedback(attempt, lastFailure.violations);
        const response = await this.client.responses.parse(
          buildOpenAIRequest(supplier, context, repair),
          { signal: controller.signal },
        );
        responses.push(response);
        const outcome = outcomeOf(response, supplier, context);

        if (outcome.status === "proposal")
          return {
            status: "proposal",
            proposal: outcome.proposal,
            metadata: metadataFor(startedAt, contextHash, responses, failures),
          };

        lastFailure = outcome;
        failures.push(
          ...outcome.violations.map((reason) => `attempt-${attempt}:${reason}`),
        );
      }

      return {
        status: lastFailure.status,
        reason: lastFailure.violations.join(","),
        metadata: metadataFor(startedAt, contextHash, responses, failures),
      };
    } catch (_error) {
      const timedOut = controller.signal.aborted;

      return {
        status: timedOut ? "timeout" : "provider_error",
        reason: timedOut ? "provider_timeout" : "provider_failure",
        metadata: metadataFor(startedAt, contextHash, responses, failures),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
