import type { RequestContext } from "../context.js";
import type { CommandHandler } from "../core/handlers.js";
import type { UnitOfWork } from "../core/unit-of-work.js";
import { ApplicationError } from "../errors.js";
import type {
  Clock,
  ConfirmationTokenService,
  DomainEventWriter,
  IdGenerator,
  JobScheduler,
  NegotiationRepository,
  NegotiationView,
  ScenarioSelectionRepository,
} from "../ports/index.js";

const suppliers = ["S1", "S2", "S3"] as const;

export type StartNegotiationInput = Readonly<{
  quotationId: string;
  scenarioId: string;
  policyHash: string;
  confirmationToken: string;
}>;

type Dependencies = Readonly<{
  unitOfWork: UnitOfWork;
  negotiations: NegotiationRepository;
  jobs: JobScheduler;
  events: DomainEventWriter;
  ids: IdGenerator;
  scenarios: ScenarioSelectionRepository;
  confirmationTokens: ConfirmationTokenService;
  clock: Clock;
}>;
type Transaction = Parameters<Parameters<UnitOfWork["run"]>[0]>[0];

export class StartNegotiationCommandHandler
  implements CommandHandler<StartNegotiationInput, NegotiationView>
{
  constructor(private readonly dependencies: Dependencies) {}

  execute(
    context: RequestContext,
    input: StartNegotiationInput,
  ): Promise<NegotiationView> {
    return this.dependencies.unitOfWork.run((transaction) =>
      this.start(context, input, transaction),
    );
  }

  private async start(
    context: RequestContext,
    input: StartNegotiationInput,
    transaction: Transaction,
  ) {
    await this.assertScenarioSelected(transaction, context, input);
    const facts = await this.dependencies.negotiations.loadStartFacts(
      transaction,
      context.brandId,
      input.quotationId,
      input.scenarioId,
    );

    if (!facts)
      throw new ApplicationError(
        "quotation-not-found",
        404,
        "Quotation not found",
      );
    if (facts.quotationState !== "READY")
      throw new ApplicationError(
        "quotation-not-ready",
        409,
        "Quotation must be READY before negotiation",
      );
    if (facts.unresolvedMatchCount !== 0)
      throw new ApplicationError(
        "matches-unresolved",
        409,
        "Selected scenario has unresolved matches",
      );
    if (facts.lines.length === 0)
      throw new ApplicationError(
        "order-intent-empty",
        422,
        "Selected scenario has no matched commercial lines",
      );

    const policy = this.dependencies.confirmationTokens.verifyPolicy(
      input.confirmationToken,
      {
        quotationId: input.quotationId,
        scenarioId: input.scenarioId,
        policyHash: input.policyHash,
        brandId: context.brandId,
        actorId: context.actorId,
      },
      this.dependencies.clock.now(),
    );

    if (!policy)
      throw new ApplicationError(
        "policy-confirmation-stale",
        409,
        "Policy confirmation is invalid or expired; review the policy again",
      );

    const orderIntentId = this.dependencies.ids.next();
    const negotiationId = this.dependencies.ids.next();

    await this.dependencies.negotiations.createOrderIntent(transaction, {
      id: orderIntentId,
      brandId: context.brandId,
      quotationId: input.quotationId,
      scenarioId: input.scenarioId,
      currency: facts.currency,
      lines: facts.lines,
    });
    await this.dependencies.negotiations.create(transaction, {
      id: negotiationId,
      brandId: context.brandId,
      quotationId: input.quotationId,
      orderIntentId,
      state: "ROUND_1_RUNNING",
      policyVersion: policy.version,
      policySnapshot: policy,
      modelSnapshot: {
        version: "supplier-proposal-v1",
      },
      version: 1,
    });

    await this.scheduleRoundOne(transaction, context, input, negotiationId);

    return {
      id: negotiationId,
      status: "ROUND_1_RUNNING",
      timeline: [],
      reducedCompetition: false,
      offers: [],
    };
  }

  private async scheduleRoundOne(
    transaction: Transaction,
    context: RequestContext,
    input: StartNegotiationInput,
    negotiationId: string,
  ): Promise<void> {
    for (const supplierId of suppliers) {
      await this.dependencies.jobs.enqueue(transaction, {
        name: "negotiation-turn",
        payload: {
          negotiationId,
          brandId: context.brandId,
          supplierId,
          round: 1,
          expectedVersion: 1,
          correlationId: context.correlationId,
        },
        correlationId: context.correlationId,
        idempotencyKey: `${context.brandId}:${negotiationId}:${supplierId}:1`,
      });
    }

    await this.dependencies.events.append(transaction, {
      brandId: context.brandId,
      aggregateType: "negotiation",
      aggregateId: negotiationId,
      type: "negotiation.started",
      schemaVersion: "1",
      payload: { quotationId: input.quotationId },
      correlationId: context.correlationId,
      idempotencyKey: `negotiation-started:${context.brandId}:${negotiationId}`,
    });
  }

  private async assertScenarioSelected(
    transaction: Transaction,
    context: RequestContext,
    input: StartNegotiationInput,
  ): Promise<void> {
    const selectedScenario = await this.dependencies.scenarios.selectedScenario(
      transaction,
      context.brandId,
      input.quotationId,
    );
    if (selectedScenario !== input.scenarioId)
      throw new ApplicationError(
        "scenario-not-selected",
        409,
        "Negotiation requires an explicitly selected scenario",
      );
  }
}
