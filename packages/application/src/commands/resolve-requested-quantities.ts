import type { RequestContext } from "../context.js";
import type { CommandHandler } from "../core/handlers.js";
import type { UnitOfWork } from "../core/unit-of-work.js";
import { ApplicationError } from "../errors.js";
import type {
  CommercialReviewRepository,
  MatchingRepository,
  QuotationRepository,
  ScenarioSelectionRepository,
} from "../ports/index.js";

export type ResolveRequestedQuantitiesInput = Readonly<{
  quotationId: string;
  scenarioId: string;
  lines: readonly Readonly<{
    parsedLineId: string;
    requestedQuantity: string;
  }>[];
}>;

type Dependencies = Readonly<{
  unitOfWork: UnitOfWork;
  quotations: QuotationRepository;
  matches: MatchingRepository;
  scenarios: ScenarioSelectionRepository;
  commercialReview: CommercialReviewRepository;
}>;

export class ResolveRequestedQuantitiesCommandHandler
  implements CommandHandler<ResolveRequestedQuantitiesInput, void>
{
  constructor(private readonly dependencies: Dependencies) {}

  execute(
    context: RequestContext,
    input: ResolveRequestedQuantitiesInput,
  ): Promise<void> {
    return this.dependencies.unitOfWork.run(async (transaction) => {
      const quotation = await this.dependencies.quotations.loadForUpdate(
        transaction,
        context.brandId,
        input.quotationId,
      );
      if (!quotation)
        throw new ApplicationError(
          "quotation-not-found",
          404,
          "Quotation not found",
        );
      if (
        !["INTERPRETATION_REQUIRED", "REVIEW_REQUIRED", "READY"].includes(
          quotation.state,
        )
      )
        throw new ApplicationError(
          "commercial-review-not-ready",
          409,
          "Quotation is not ready for commercial review",
        );

      const selectedScenario =
        await this.dependencies.scenarios.selectedScenario(
          transaction,
          context.brandId,
          input.quotationId,
        );
      if (selectedScenario !== input.scenarioId)
        throw new ApplicationError(
          "scenario-not-selected",
          409,
          "Select this quotation scenario before reviewing quantities",
        );

      const persisted =
        await this.dependencies.commercialReview.resolveQuantities(
          transaction,
          {
            brandId: context.brandId,
            actorId: context.actorId,
            quotationId: input.quotationId,
            scenarioId: input.scenarioId,
            lines: input.lines.map((line) => ({
              parsedLineId: line.parsedLineId,
              requestedQuantity: BigInt(line.requestedQuantity),
            })),
          },
        );
      if (!persisted)
        throw new ApplicationError(
          "quotation-line-not-found",
          404,
          "A quotation line was not found in the selected scenario",
        );

      const [resolution, commercialBlockers] = await Promise.all([
        this.dependencies.matches.resolutionSummary(
          transaction,
          context.brandId,
          input.quotationId,
          input.scenarioId,
        ),
        this.dependencies.commercialReview.hasBlockers(
          transaction,
          context.brandId,
          input.scenarioId,
        ),
      ]);
      if (
        resolution.unresolved === 0 &&
        resolution.included > 0 &&
        !commercialBlockers &&
        quotation.state !== "READY"
      )
        await this.dependencies.quotations.transition(transaction, {
          brandId: context.brandId,
          id: quotation.id,
          expectedVersion: quotation.version,
          nextState: "READY",
        });
    });
  }
}
