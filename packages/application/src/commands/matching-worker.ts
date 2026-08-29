import type { BrandId } from "@procurement/domain";
import type { UnitOfWork } from "../core/unit-of-work.js";
import type { CatalogMatcher } from "../ports/external.js";
import type {
  CatalogRepository,
  MatchCandidateInput,
  MatchingRepository,
} from "../ports/matching.js";

type Dependencies = Readonly<{
  matches: MatchingRepository;
  catalog: CatalogRepository;
  matcher: CatalogMatcher;
  unitOfWork: UnitOfWork;
}>;

const corroboration = (input: MatchCandidateInput) => ({
  ...(input.description === undefined
    ? {}
    : { description: input.description }),
  ...(input.color === undefined ? {} : { color: input.color }),
  ...(input.size === undefined ? {} : { size: input.size }),
});

export class GenerateMatchCandidatesCommandHandler {
  constructor(private readonly dependencies: Dependencies) {}

  execute(
    command: Readonly<{
      brandId: BrandId;
      quotationId: string;
    }>,
  ): Promise<void> {
    return this.dependencies.unitOfWork.run(async (transaction) => {
      const inputs = await this.dependencies.matches.listCandidateInputs(
        transaction,
        command.brandId,
        command.quotationId,
      );
      if (inputs.length === 0) return;
      const versions = new Set(inputs.map((input) => input.catalogVersion));

      if (versions.size !== 1)
        throw new Error("quotation catalog version is inconsistent");

      const catalogVersion = inputs[0]?.catalogVersion;

      if (!catalogVersion)
        throw new Error("quotation catalog version is unavailable");

      const catalog = await this.dependencies.catalog.listVersion(
        transaction,
        command.brandId,
        catalogVersion,
      );

      for (const input of inputs) {
        const match = this.dependencies.matcher.match({
          rawSku: input.rawSku,
          catalog,
          brandId: command.brandId,
          corroboration: corroboration(input),
        });

        await this.dependencies.matches.appendCandidate(transaction, {
          brandId: command.brandId,
          parsedLineId: input.parsedLineId,
          candidates: match.candidates,
          ...(match.selectedProductId === undefined
            ? {}
            : { selectedProductId: match.selectedProductId }),
        });
      }
    });
  }
}
