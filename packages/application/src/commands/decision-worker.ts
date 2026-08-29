import type { BrandId } from "@procurement/domain";
import type { UnitOfWork } from "../core/unit-of-work.js";
import type { DomainEventWriter } from "../ports/events.js";
import type { JsonValue } from "../ports/json.js";
import type {
  DecisionInputs,
  NegotiationRepository,
} from "../ports/negotiation.js";

export type DecisionMaker = (input: DecisionInputs) => JsonValue;

const jsonRecord = (
  value: JsonValue,
): value is Readonly<Record<string, JsonValue>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export class ContinueDecisionCommandHandler {
  constructor(
    private readonly dependencies: Readonly<{
      negotiations: NegotiationRepository;
      unitOfWork: UnitOfWork;
      decide: DecisionMaker;
      events: DomainEventWriter;
    }>,
  ) {}

  execute(
    command: Readonly<{
      brandId: BrandId;
      negotiationId: string;
      expectedVersion: number;
      correlationId: string;
    }>,
  ): Promise<void> {
    return this.dependencies.unitOfWork.run(async (transaction) => {
      const inputs = await this.dependencies.negotiations.loadDecisionInputs(
        transaction,
        command.brandId,
        command.negotiationId,
      );

      if (
        inputs?.negotiation.state !== "EVALUATED" ||
        inputs.negotiation.version !== command.expectedVersion
      )
        return;

      const recommendation = this.dependencies.decide(inputs);
      const winner = jsonRecord(recommendation)
        ? recommendation.winnerOfferId
        : undefined;
      const policy = inputs.policySnapshot;

      if (!jsonRecord(policy) || typeof policy.version !== "string")
        throw new Error("invalid decision policy snapshot");

      await this.dependencies.negotiations.saveRecommendation(
        transaction,
        command.brandId,
        command.negotiationId,
        recommendation,
        typeof winner === "string" ? winner : null,
        policy.version,
      );
      const recommended = await this.dependencies.negotiations.transition(
        transaction,
        {
          brandId: command.brandId,
          id: command.negotiationId,
          expectedState: "EVALUATED",
          expectedVersion: command.expectedVersion,
          nextState: "RECOMMENDED",
        },
      );

      if (!recommended)
        throw new Error("negotiation changed while recommendation was stored");

      await this.dependencies.events.append(transaction, {
        brandId: command.brandId,
        aggregateType: "negotiation",
        aggregateId: command.negotiationId,
        type: "decision.recommended",
        schemaVersion: "1",
        payload: {
          winnerOfferId: typeof winner === "string" ? winner : null,
          policyVersion: policy.version,
        },
        correlationId: command.correlationId,
        idempotencyKey: `decision-recommended:${command.brandId}:${command.negotiationId}`,
      });
    });
  }
}
