import type { QuotationState } from "@procurement/domain";
import type { RequestContext } from "../context.js";
import type { CommandHandler } from "../core/handlers.js";
import type { UnitOfWork } from "../core/unit-of-work.js";
import { ApplicationError } from "../errors.js";
import type {
  CatalogRepository,
  DomainEventWriter,
  IdGenerator,
  JobScheduler,
  QuotationObjectStore,
  QuotationRepository,
} from "../ports/index.js";

export type ReserveQuotationUploadInput = Readonly<{
  filename: string;
  contentHash: string;
  note?: string;
}>;

export type QuotationUploadReservation = Readonly<{
  objectKey: string;
  uploadUrl: string;
  uploadMethod: "PUT";
  headers: Readonly<Record<string, string>>;
}>;

export class ReserveQuotationUploadCommandHandler
  implements
    CommandHandler<ReserveQuotationUploadInput, QuotationUploadReservation>
{
  constructor(private readonly objects: QuotationObjectStore) {}

  async execute(
    context: RequestContext,
    input: ReserveQuotationUploadInput,
  ): Promise<QuotationUploadReservation> {
    const reservation = await this.objects.reserveUpload({
      brandId: context.brandId,
      filename: input.filename,
      contentHash: input.contentHash,
    });

    return {
      objectKey: reservation.key,
      uploadUrl: reservation.url,
      uploadMethod: "PUT",
      headers: reservation.headers,
    };
  }
}

export type CompleteQuotationUploadInput = Readonly<{
  objectKey: string;
  contentHash: string;
  note?: string;
  idempotencyKey: string;
}>;

export type CompleteQuotationUploadResult = Readonly<{
  id: string;
  state: QuotationState;
  replayed: boolean;
}>;

type CompleteDependencies = Readonly<{
  unitOfWork: UnitOfWork;
  objects: QuotationObjectStore;
  quotations: QuotationRepository;
  catalog: CatalogRepository;
  events: DomainEventWriter;
  jobs: JobScheduler;
  ids: IdGenerator;
}>;

export class CompleteQuotationUploadCommandHandler
  implements
    CommandHandler<CompleteQuotationUploadInput, CompleteQuotationUploadResult>
{
  constructor(private readonly dependencies: CompleteDependencies) {}

  async execute(
    context: RequestContext,
    input: CompleteQuotationUploadInput,
  ): Promise<CompleteQuotationUploadResult> {
    const existing = await this.dependencies.quotations.findReservation(
      context.brandId,
      input.idempotencyKey,
    );

    if (existing) return this.replay(existing, input);

    const duplicate = await this.dependencies.quotations.findByContentHash(
      context.brandId,
      input.contentHash,
    );

    if (duplicate && (duplicate.note ?? undefined) !== input.note)
      throw new ApplicationError(
        "quotation-context-conflict",
        409,
        "This workbook was already uploaded with different commercial context",
      );

    if (duplicate)
      return { id: duplicate.id, state: duplicate.state, replayed: true };

    await this.dependencies.objects.verifyUpload({
      brandId: context.brandId,
      key: input.objectKey,
      contentHash: input.contentHash,
    });

    return this.dependencies.unitOfWork.run(async (transaction) => {
      const catalogVersion = await this.dependencies.catalog.currentVersion(
        transaction,
        context.brandId,
      );

      if (!catalogVersion)
        throw new ApplicationError(
          "catalog-unavailable",
          409,
          "A catalog must be loaded before accepting quotations",
        );

      const id = this.dependencies.ids.next();
      const quotation = await this.dependencies.quotations.insert(transaction, {
        id,
        brandId: context.brandId,
        state: "UPLOADED",
        objectKey: input.objectKey,
        contentHash: input.contentHash,
        catalogVersion,
        note: input.note ?? null,
        idempotencyKey: input.idempotencyKey,
      });

      await this.dependencies.events.append(transaction, {
        brandId: context.brandId,
        aggregateType: "quotation",
        aggregateId: id,
        type: "quotation.uploaded",
        schemaVersion: "1",
        payload: { objectKey: input.objectKey },
        correlationId: context.correlationId,
        idempotencyKey: `upload:${id}`,
      });
      await this.dependencies.jobs.enqueue(transaction, {
        name: "preflight-quotation",
        payload: {
          brandId: context.brandId,
          quotationId: id,
          objectKey: input.objectKey,
          correlationId: context.correlationId,
        },
        correlationId: context.correlationId,
        idempotencyKey: `preflight:${context.brandId}:${id}`,
      });

      return { id, state: quotation.state, replayed: false };
    });
  }

  private replay(
    existing: NonNullable<
      Awaited<ReturnType<QuotationRepository["findReservation"]>>
    >,
    input: CompleteQuotationUploadInput,
  ): CompleteQuotationUploadResult {
    if (
      existing.contentHash !== input.contentHash ||
      existing.objectKey !== input.objectKey ||
      (existing.note ?? undefined) !== input.note
    )
      throw new ApplicationError(
        "idempotency-conflict",
        409,
        "Idempotency key was already used for different content",
      );

    return { id: existing.id, state: existing.state, replayed: true };
  }
}
