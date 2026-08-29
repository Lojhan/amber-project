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

export type SelectQuotationScenarioInput = Readonly<{
  quotationId: string;
  scenarioId: string;
}>;

export class SelectQuotationScenarioCommandHandler
  implements CommandHandler<SelectQuotationScenarioInput, void>
{
  constructor(
    private readonly dependencies: Readonly<{
      unitOfWork: UnitOfWork;
      quotations: QuotationRepository;
      matches: MatchingRepository;
      scenarios: ScenarioSelectionRepository;
      commercialReview: CommercialReviewRepository;
    }>,
  ) {}

  execute(
    context: RequestContext,
    input: SelectQuotationScenarioInput,
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
          "scenario-selection-not-ready",
          409,
          "Quotation is not ready for scenario selection",
        );
      if (
        !(await this.dependencies.scenarios.selectScenario(transaction, {
          brandId: context.brandId,
          quotationId: input.quotationId,
          scenarioId: input.scenarioId,
          actorId: context.actorId,
        }))
      )
        throw new ApplicationError(
          "scenario-not-found",
          404,
          "Scenario not found for quotation",
        );

      const resolution = await this.dependencies.matches.resolutionSummary(
        transaction,
        context.brandId,
        input.quotationId,
        input.scenarioId,
      );
      const interpretationBlocked =
        await this.dependencies.commercialReview.hasBlockers(
          transaction,
          context.brandId,
          input.scenarioId,
        );

      if (
        resolution.unresolved === 0 &&
        resolution.included > 0 &&
        !interpretationBlocked &&
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
