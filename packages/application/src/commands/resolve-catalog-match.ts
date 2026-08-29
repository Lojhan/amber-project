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

export type ResolveCatalogMatchInput = Readonly<{
  quotationId: string;
  scenarioId: string;
  matchId: string;
  action: "accept" | "select" | "exclude";
  selectedProductId?: string;
  rationale?: string;
}>;

type Dependencies = Readonly<{
  unitOfWork: UnitOfWork;
  quotations: QuotationRepository;
  matches: MatchingRepository;
  scenarios: ScenarioSelectionRepository;
  commercialReview: CommercialReviewRepository;
}>;

export class ResolveCatalogMatchCommandHandler
  implements CommandHandler<ResolveCatalogMatchInput, void>
{
  constructor(private readonly dependencies: Dependencies) {}

  async execute(
    context: RequestContext,
    input: ResolveCatalogMatchInput,
  ): Promise<void> {
    this.validate(input);

    await this.dependencies.unitOfWork.run(async (transaction) => {
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
          "matching-not-ready",
          409,
          "Quotation is not ready for catalog review",
        );

      const outcome = await this.dependencies.matches.resolve(transaction, {
        brandId: context.brandId,
        actorId: context.actorId,
        ...input,
      });
      const resolution = await this.dependencies.matches.resolutionSummary(
        transaction,
        context.brandId,
        input.quotationId,
        outcome.scenarioId,
      );

      const selectedScenario =
        await this.dependencies.scenarios.selectedScenario(
          transaction,
          context.brandId,
          input.quotationId,
        );
      const interpretationBlocked =
        await this.dependencies.commercialReview.hasBlockers(
          transaction,
          context.brandId,
          outcome.scenarioId,
        );

      if (
        resolution.unresolved === 0 &&
        resolution.included > 0 &&
        !interpretationBlocked &&
        selectedScenario === outcome.scenarioId &&
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

  private validate(input: ResolveCatalogMatchInput): void {
    if (input.action === "select" && !input.selectedProductId)
      throw new ApplicationError(
        "product-required",
        422,
        "A catalog product is required",
      );
    if (input.action === "exclude" && input.selectedProductId)
      throw new ApplicationError(
        "invalid-match-resolution",
        422,
        "Excluded matches cannot select a product",
      );
  }
}
