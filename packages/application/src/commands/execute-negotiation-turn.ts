import type { BrandId } from "@procurement/domain";
import type { UnitOfWork } from "../core/unit-of-work.js";
import {
  conversationFromTurns,
  negotiationProviderMetadata,
  negotiationTurnResult,
} from "../negotiation-conversation.js";
import type {
  BrandNegotiationModel,
  JobScheduler,
  NegotiationRepository,
  SupplierId,
  SupplierProposalModel,
} from "../ports/index.js";

export type ExecuteNegotiationTurnInput = Readonly<{
  brandId: BrandId;
  negotiationId: string;
  supplierId: SupplierId;
  round: 1 | 2;
  expectedVersion: number;
  correlationId: string;
}>;

type Dependencies = Readonly<{
  unitOfWork: UnitOfWork;
  negotiations: NegotiationRepository;
  brand: BrandNegotiationModel;
  proposals: SupplierProposalModel;
  jobs: JobScheduler;
}>;

const stateForRound = (round: 1 | 2) =>
  round === 1 ? ("ROUND_1_RUNNING" as const) : ("ROUND_2_RUNNING" as const);

const turnKey = (supplierId: SupplierId, round: 1 | 2) =>
  `${supplierId}:${round}:proposal`;

const priorConversations = (
  turns: Awaited<ReturnType<NegotiationRepository["listTurns"]>>,
  input: ExecuteNegotiationTurnInput,
) => {
  const priorTurns = turns.filter((turn) => turn.round < input.round);

  return {
    priorConversation: conversationFromTurns(priorTurns),
    supplierConversation: conversationFromTurns(
      priorTurns.filter((turn) => turn.supplierId === input.supplierId),
    ),
  };
};

export class ExecuteNegotiationTurnCommandHandler {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(input: ExecuteNegotiationTurnInput): Promise<void> {
    const prepared = await this.dependencies.unitOfWork.run(
      async (transaction) => {
        const run = await this.dependencies.negotiations.loadRun(
          transaction,
          input.brandId,
          input.negotiationId,
        );

        if (!run) throw new Error("negotiation run not found for brand");
        if (run.state !== stateForRound(input.round)) return null;
        if (run.version !== input.expectedVersion) return null;

        const turns = await this.dependencies.negotiations.listTurns(
          transaction,
          input.brandId,
          input.negotiationId,
        );

        if (
          turns.some(
            (turn) => turn.key === turnKey(input.supplierId, input.round),
          )
        )
          return null;

        return { run, ...priorConversations(turns, input) };
      },
    );

    if (!prepared) return;

    const brand = await this.dependencies.brand.plan({
      brandId: prepared.run.brandId,
      quotationId: prepared.run.quotationId,
      supplierId: input.supplierId,
      round: input.round,
      currency: prepared.run.currency,
      lines: prepared.run.lines,
      policySnapshot: prepared.run.policySnapshot,
      priorConversation: prepared.priorConversation,
      ...(input.round === 2 && input.supplierId === "S2"
        ? { capacityChange: { supplierId: "S2", capacityPercent: 60 } }
        : {}),
    });
    const proposal = await this.dependencies.proposals.propose({
      brandId: prepared.run.brandId,
      quotationId: prepared.run.quotationId,
      supplierId: input.supplierId,
      round: input.round,
      currency: prepared.run.currency,
      lines: prepared.run.lines,
      brandMessage: brand.move.message,
      priorConversation: prepared.supplierConversation,
    });

    await this.dependencies.unitOfWork.run(async (transaction) => {
      const run = await this.dependencies.negotiations.loadRun(
        transaction,
        input.brandId,
        input.negotiationId,
      );

      if (!run || run.state !== stateForRound(input.round)) return;

      await this.dependencies.negotiations.appendTurn(
        transaction,
        input.brandId,
        input.negotiationId,
        {
          key: turnKey(input.supplierId, input.round),
          supplierId: input.supplierId,
          round: input.round,
          status: proposal.status,
          result: negotiationTurnResult(brand, proposal),
          providerMetadata: negotiationProviderMetadata(brand, proposal),
        },
      );

      const turns = await this.dependencies.negotiations.listTurns(
        transaction,
        input.brandId,
        input.negotiationId,
      );
      const completed = turns.filter((turn) => turn.round === input.round);

      if (completed.length !== 3) return;
      if (input.round === 1)
        await this.advanceToRoundTwo(transaction, input, run.version);
      else await this.advanceToDecision(transaction, input, run.version);
    });
  }

  private async advanceToRoundTwo(
    transaction: Parameters<NegotiationRepository["transition"]>[0],
    input: ExecuteNegotiationTurnInput,
    version: number,
  ): Promise<void> {
    const completed = await this.dependencies.negotiations.transition(
      transaction,
      {
        brandId: input.brandId,
        id: input.negotiationId,
        expectedState: "ROUND_1_RUNNING",
        expectedVersion: version,
        nextState: "ROUND_1_COMPLETE",
      },
    );

    if (!completed) return;

    await this.dependencies.negotiations.applyCapacityEvent(
      transaction,
      input.brandId,
      input.negotiationId,
      { supplierId: "S2", fromPercent: 100, toPercent: 60 },
    );
    await this.dependencies.negotiations.transition(transaction, {
      brandId: input.brandId,
      id: input.negotiationId,
      expectedState: "ROUND_1_COMPLETE",
      expectedVersion: version + 1,
      nextState: "CAPACITY_EVENT_APPLIED",
    });
    await this.dependencies.negotiations.transition(transaction, {
      brandId: input.brandId,
      id: input.negotiationId,
      expectedState: "CAPACITY_EVENT_APPLIED",
      expectedVersion: version + 2,
      nextState: "ROUND_2_RUNNING",
    });

    for (const supplierId of ["S1", "S2", "S3"] as const)
      await this.dependencies.jobs.enqueue(transaction, {
        name: "negotiation-turn",
        payload: {
          negotiationId: input.negotiationId,
          brandId: input.brandId,
          supplierId,
          round: 2,
          expectedVersion: version + 3,
          correlationId: input.correlationId,
        },
        correlationId: input.correlationId,
        idempotencyKey: `${input.brandId}:${input.negotiationId}:${supplierId}:2`,
      });
  }

  private async advanceToDecision(
    transaction: Parameters<NegotiationRepository["transition"]>[0],
    input: ExecuteNegotiationTurnInput,
    version: number,
  ): Promise<void> {
    const completed = await this.dependencies.negotiations.transition(
      transaction,
      {
        brandId: input.brandId,
        id: input.negotiationId,
        expectedState: "ROUND_2_RUNNING",
        expectedVersion: version,
        nextState: "EVALUATED",
      },
    );

    if (!completed) return;

    await this.dependencies.jobs.enqueue(transaction, {
      name: "decision-continuation",
      payload: {
        negotiationId: input.negotiationId,
        brandId: input.brandId,
        expectedVersion: version + 1,
        correlationId: input.correlationId,
      },
      correlationId: input.correlationId,
      idempotencyKey: `${input.brandId}:${input.negotiationId}:decision:${version + 1}`,
    });
  }
}
