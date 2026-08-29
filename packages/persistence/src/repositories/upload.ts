import { randomUUID } from "node:crypto";
import type {
  ParsedQuotation,
  ParseTarget,
  QuotationJob,
  UploadRepository,
} from "@procurement/application/ports";
import type { Database } from "@procurement/db";
import {
  parsedQuoteLines,
  quotations,
  quoteScenarios,
} from "@procurement/db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";

const requireChangedRow = <T>(rows: readonly T[], message: string): void => {
  if (rows.length !== 1) throw new Error(message);
};

/** Typed Drizzle adapter for quotation preflight, parsing, and persistence. */
export class DrizzleUploadRepository implements UploadRepository {
  constructor(
    private readonly database: Database,
    private readonly unitOfWork: DrizzleUnitOfWork,
    private readonly createId: () => string = randomUUID,
  ) {}

  async loadParseTarget(job: QuotationJob): Promise<ParseTarget | null> {
    const rows = await this.database
      .select({
        state: quotations.state,
        objectKey: quotations.objectKey,
        contentHash: quotations.fileHash,
        scenarioCount: count(quoteScenarios.id),
      })
      .from(quotations)
      .leftJoin(
        quoteScenarios,
        and(
          eq(quoteScenarios.brandId, quotations.brandId),
          eq(quoteScenarios.quotationId, quotations.id),
        ),
      )
      .where(
        and(
          eq(quotations.brandId, job.brandId),
          eq(quotations.id, job.quotationId),
        ),
      )
      .groupBy(quotations.id, quotations.brandId)
      .limit(1);
    return rows[0] ?? null;
  }

  async finishPreflight(
    transaction: Parameters<UploadRepository["finishPreflight"]>[0],
    job: QuotationJob,
    safe: boolean,
    reason?: string,
  ): Promise<void> {
    const rows = await this.transition(
      transaction,
      job,
      "UPLOADED",
      safe ? "PARSING" : "REJECTED",
      safe ? undefined : (reason ?? "preflight_rejected"),
    );
    requireChangedRow(rows, "quotation preflight state conflict");
  }

  async persistParsedQuotation(
    transaction: Parameters<UploadRepository["persistParsedQuotation"]>[0],
    job: QuotationJob,
    quotation: ParsedQuotation,
  ): Promise<void> {
    const database = this.unitOfWork.databaseFor(transaction);
    await this.assertParsing(database, job);

    for (const scenario of quotation.scenarios) {
      const scenarioId = this.createId();
      await database.insert(quoteScenarios).values({
        id: scenarioId,
        brandId: job.brandId,
        quotationId: job.quotationId,
        sourceSheet: scenario.sourceSheet,
        rationale: scenario.rationale,
        metadata: scenario.metadata,
      });
      if (scenario.lines.length > 0)
        await database.insert(parsedQuoteLines).values(
          scenario.lines.map((line) => ({
            id: this.createId(),
            brandId: job.brandId,
            scenarioId,
            sourceEvidence: line.sourceEvidence,
            normalizedCandidates: line.normalizedCandidates,
            rawValue: line.rawValue,
          })),
        );
    }
  }

  async markParseFailed(
    transaction: Parameters<UploadRepository["markParseFailed"]>[0],
    job: QuotationJob,
    reason: string,
  ): Promise<void> {
    const rows = await this.unitOfWork
      .databaseFor(transaction)
      .update(quotations)
      .set({
        state: "PARSE_FAILED",
        failureDetail: reason,
        version: sql`${quotations.version} + 1`,
      })
      .where(
        and(
          eq(quotations.brandId, job.brandId),
          eq(quotations.id, job.quotationId),
          eq(quotations.state, "PARSING"),
        ),
      )
      .returning({ id: quotations.id });
    requireChangedRow(rows, "quotation parse state conflict");
  }

  async finishParse(
    transaction: Parameters<UploadRepository["finishParse"]>[0],
    job: QuotationJob,
    nextState: "INTERPRETATION_REQUIRED" | "REVIEW_REQUIRED",
  ): Promise<void> {
    const rows = await this.transition(transaction, job, "PARSING", nextState);
    requireChangedRow(rows, "quotation parse state conflict");
  }

  private transition(
    transaction: Parameters<UploadRepository["finishPreflight"]>[0],
    job: QuotationJob,
    state: "UPLOADED" | "PARSING",
    nextState:
      | "REJECTED"
      | "PARSING"
      | "INTERPRETATION_REQUIRED"
      | "REVIEW_REQUIRED",
    failureDetail?: string,
  ) {
    return this.unitOfWork
      .databaseFor(transaction)
      .update(quotations)
      .set({
        state: nextState,
        ...(failureDetail === undefined ? {} : { failureDetail }),
        version: sql`${quotations.version} + 1`,
      })
      .where(
        and(
          eq(quotations.brandId, job.brandId),
          eq(quotations.id, job.quotationId),
          eq(quotations.state, state),
        ),
      )
      .returning({ id: quotations.id });
  }

  private async assertParsing(
    database: ReturnType<DrizzleUnitOfWork["databaseFor"]>,
    job: QuotationJob,
  ): Promise<void> {
    const rows = await database
      .select({ id: quotations.id })
      .from(quotations)
      .where(
        and(
          eq(quotations.brandId, job.brandId),
          eq(quotations.id, job.quotationId),
          eq(quotations.state, "PARSING"),
        ),
      )
      .for("update")
      .limit(1);
    requireChangedRow(rows, "quotation parse state conflict");
  }
}
