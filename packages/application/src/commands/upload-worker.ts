import type { UnitOfWork } from "../core/unit-of-work.js";
import type { DomainEventWriter, JobScheduler } from "../ports/events.js";
import type {
  HashingService,
  QuotationObjectStore,
  WorkbookParser,
} from "../ports/external.js";
import type { JsonValue } from "../ports/json.js";
import type {
  ParsedQuotation,
  QuotationJob,
  UploadRepository,
} from "../ports/upload.js";

const parseKey = (job: QuotationJob) =>
  `parse:${job.brandId}:${job.quotationId}`;

const jobPayload = (job: QuotationJob): JsonValue => ({
  brandId: job.brandId,
  quotationId: job.quotationId,
  objectKey: job.objectKey,
  correlationId: job.correlationId,
});

const completedParseReplay = (target: {
  state: string;
  scenarioCount: number;
}) =>
  (target.state === "INTERPRETATION_REQUIRED" ||
    target.state === "REVIEW_REQUIRED") &&
  target.scenarioCount > 0;

export class CompleteQuotationPreflightCommandHandler {
  constructor(
    private readonly dependencies: Readonly<{
      objects: QuotationObjectStore;
      parser: WorkbookParser;
      uploads: UploadRepository;
      jobs: JobScheduler;
      unitOfWork: UnitOfWork;
    }>,
  ) {}

  async execute(job: QuotationJob): Promise<void> {
    const bytes = await this.dependencies.objects.read({
      brandId: job.brandId,
      key: job.objectKey,
    });
    const result = await this.dependencies.parser.preflight(bytes);

    await this.dependencies.unitOfWork.run(async (transaction) => {
      await this.dependencies.uploads.finishPreflight(
        transaction,
        job,
        result.safe,
        result.reason,
      );

      if (!result.safe) return;

      await this.dependencies.jobs.enqueue(transaction, {
        name: "parse-quotation",
        payload: jobPayload(job),
        correlationId: job.correlationId,
        idempotencyKey: parseKey(job),
      });
    });
  }
}

type ParseDependencies = Readonly<{
  objects: QuotationObjectStore;
  parser: WorkbookParser;
  uploads: UploadRepository;
  jobs: JobScheduler;
  events: DomainEventWriter;
  hashing: HashingService;
  unitOfWork: UnitOfWork;
}>;

export class ParseQuotationCommandHandler {
  constructor(private readonly dependencies: ParseDependencies) {}

  async execute(job: QuotationJob): Promise<void> {
    const target = await this.dependencies.uploads.loadParseTarget(job);

    if (!target || target.objectKey !== job.objectKey)
      throw new Error("quotation parse gate state conflict");
    if (target.state !== "PARSING") {
      if (completedParseReplay(target)) return;
      throw new Error("quotation parse gate state conflict");
    }

    const bytes = await this.dependencies.objects.read({
      brandId: job.brandId,
      key: job.objectKey,
    });

    if (this.dependencies.hashing.sha256(bytes) !== target.contentHash) {
      await this.dependencies.unitOfWork.run((transaction) =>
        this.dependencies.uploads.markParseFailed(
          transaction,
          job,
          "content_hash_mismatch",
        ),
      );
      return;
    }

    const parsed = await this.parse(bytes, job);

    if (!parsed) return;

    const nextState = parsed.requiresInterpretation
      ? "INTERPRETATION_REQUIRED"
      : "REVIEW_REQUIRED";

    await this.dependencies.unitOfWork.run(async (transaction) => {
      await this.dependencies.uploads.persistParsedQuotation(
        transaction,
        job,
        parsed,
      );
      await this.dependencies.uploads.finishParse(transaction, job, nextState);
      await this.dependencies.events.append(transaction, {
        brandId: job.brandId,
        aggregateType: "quotation",
        aggregateId: job.quotationId,
        type: "quotation.parsed",
        schemaVersion: "1",
        payload: { state: nextState, scenarioCount: parsed.scenarios.length },
        correlationId: job.correlationId,
        idempotencyKey: `parsed:${job.brandId}:${job.quotationId}`,
      });
      await this.dependencies.jobs.enqueue(transaction, {
        name: "match-candidates",
        payload: {
          brandId: job.brandId,
          quotationId: job.quotationId,
          correlationId: job.correlationId,
        },
        correlationId: job.correlationId,
        idempotencyKey: `match:${job.brandId}:${job.quotationId}`,
      });
    });
  }

  private async parse(
    bytes: Uint8Array,
    job: QuotationJob,
  ): Promise<ParsedQuotation | null> {
    try {
      return await this.dependencies.parser.parse(bytes);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.startsWith("isolated parser")
      )
        throw error;

      await this.dependencies.unitOfWork.run((transaction) =>
        this.dependencies.uploads.markParseFailed(
          transaction,
          job,
          "parser_failed",
        ),
      );
      return null;
    }
  }
}
