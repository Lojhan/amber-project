import type { RequestContext } from "../context.js";
import type { CommandHandler } from "../core/handlers.js";
import type { UnitOfWork } from "../core/unit-of-work.js";
import type {
  ChallengeResetRepository,
  QuotationObjectStore,
} from "../ports/index.js";

type Dependencies = Readonly<{
  unitOfWork: UnitOfWork;
  resets: ChallengeResetRepository;
  objects: Pick<QuotationObjectStore, "remove">;
}>;

export class ResetChallengeCommandHandler
  implements CommandHandler<Readonly<Record<string, never>>, void>
{
  constructor(private readonly dependencies: Dependencies) {}

  async execute(
    context: RequestContext,
    _input: Readonly<Record<string, never>>,
  ): Promise<void> {
    const objectKeys = await this.dependencies.unitOfWork.run((transaction) =>
      this.dependencies.resets.reset(transaction, context.brandId),
    );

    await Promise.all(
      objectKeys.map((key) =>
        this.dependencies.objects.remove({ brandId: context.brandId, key }),
      ),
    );
  }
}
