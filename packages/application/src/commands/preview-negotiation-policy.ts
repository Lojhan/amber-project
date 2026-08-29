import type { RequestContext } from "../context.js";
import type { CommandHandler } from "../core/handlers.js";
import { ApplicationError } from "../errors.js";
import {
  defaultCommercialNoteInterpretation,
  deriveNegotiationPolicy,
} from "../negotiation-policy.js";
import type {
  Clock,
  CommercialNoteInterpreter,
  ConfirmationTokenService,
} from "../ports/external.js";
import type { CommercialNoteInterpretation } from "../ports/negotiation.js";
import type { NegotiationPolicyReadModel } from "../ports/read-models.js";

export type PreviewNegotiationPolicyInput = Readonly<{
  quotationId: string;
  scenarioId: string;
}>;

export type NegotiationPolicyPreview = Readonly<{
  quotationId: string;
  scenarioId: string;
  policyVersion: string;
  policyHash: string;
  weights: Readonly<{
    cost: string;
    quality: string;
    lead: string;
    payment: string;
  }>;
  constraints: Readonly<{ hardMaxLead?: number }>;
  interpretation: Readonly<{
    primaryPriority: "cost" | "quality" | "lead_time" | "payment_terms" | null;
    summary: string;
    warnings: readonly string[];
    source: "ai" | "default";
  }>;
  confirmationToken: string;
}>;

type Dependencies = Readonly<{
  policies: NegotiationPolicyReadModel;
  interpreter: CommercialNoteInterpreter;
  confirmationTokens: ConfirmationTokenService;
  clock: Clock;
}>;

export class PreviewNegotiationPolicyCommandHandler
  implements
    CommandHandler<PreviewNegotiationPolicyInput, NegotiationPolicyPreview>
{
  constructor(private readonly dependencies: Dependencies) {}

  async execute(
    context: RequestContext,
    input: PreviewNegotiationPolicyInput,
  ): Promise<NegotiationPolicyPreview> {
    const note = await this.dependencies.policies.quotationNote(
      context.brandId,
      input.quotationId,
      input.scenarioId,
    );

    if (note === undefined)
      throw new ApplicationError(
        "quotation-not-found",
        404,
        "Quotation was not found",
      );

    let interpretation: CommercialNoteInterpretation;
    try {
      interpretation = note
        ? await this.dependencies.interpreter.interpret(note)
        : defaultCommercialNoteInterpretation();
    } catch {
      throw new ApplicationError(
        "commercial-note-interpretation-unavailable",
        503,
        "The commercial note could not be interpreted right now",
      );
    }
    const policy = deriveNegotiationPolicy(interpretation);
    const confirmationToken = this.dependencies.confirmationTokens.issuePolicy(
      {
        quotationId: input.quotationId,
        scenarioId: input.scenarioId,
        policy,
        brandId: context.brandId,
        actorId: context.actorId,
      },
      this.dependencies.clock.now(),
    );

    return {
      quotationId: input.quotationId,
      scenarioId: input.scenarioId,
      policyVersion: policy.version,
      policyHash: policy.hash,
      weights: policy.weights,
      constraints:
        policy.hardMaxLead === undefined
          ? {}
          : { hardMaxLead: policy.hardMaxLead },
      interpretation: {
        primaryPriority: interpretation.primaryPriority,
        summary: interpretation.summary,
        warnings: interpretation.warnings,
        source: interpretation.source,
      },
      confirmationToken,
    };
  }
}
