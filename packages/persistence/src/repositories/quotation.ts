import type {
  NewQuotation,
  QuotationRecord,
  QuotationRepository,
  QuotationTransition,
} from "@procurement/application/ports";
import type { Database } from "@procurement/db";
import { quotations } from "@procurement/db/schema";
import { asBrandId } from "@procurement/domain";
import { and, eq, sql } from "drizzle-orm";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";

type QuotationRow = typeof quotations.$inferSelect;

const decodeQuotation = (row: QuotationRow): QuotationRecord => ({
  id: row.id,
  brandId: asBrandId(row.brandId),
  state: row.state,
  version: row.version,
  objectKey: row.objectKey,
  contentHash: row.fileHash,
  catalogVersion: row.catalogVersion,
  note: row.note,
});

export class DrizzleQuotationRepository implements QuotationRepository {
  constructor(
    private readonly database: Database,
    private readonly unitOfWork: DrizzleUnitOfWork,
  ) {}

  async findReservation(
    brandId: QuotationRecord["brandId"],
    idempotencyKey: string,
  ): Promise<QuotationRecord | null> {
    const row = await this.database
      .select()
      .from(quotations)
      .where(
        and(
          eq(quotations.brandId, brandId),
          eq(quotations.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);

    return row[0] ? decodeQuotation(row[0]) : null;
  }

  async findByContentHash(
    brandId: QuotationRecord["brandId"],
    contentHash: string,
  ): Promise<QuotationRecord | null> {
    const row = await this.database
      .select()
      .from(quotations)
      .where(
        and(
          eq(quotations.brandId, brandId),
          eq(quotations.fileHash, contentHash),
        ),
      )
      .limit(1);

    return row[0] ? decodeQuotation(row[0]) : null;
  }

  async insert(
    transaction: Parameters<QuotationRepository["insert"]>[0],
    quotation: NewQuotation,
  ): Promise<QuotationRecord> {
    const database = this.unitOfWork.databaseFor(transaction);
    const rows = await database
      .insert(quotations)
      .values({
        id: quotation.id,
        brandId: quotation.brandId,
        state: quotation.state,
        objectKey: quotation.objectKey,
        fileHash: quotation.contentHash,
        note: quotation.note,
        catalogVersion: quotation.catalogVersion,
        idempotencyKey: quotation.idempotencyKey,
        version: 1,
      })
      .returning();
    const row = rows[0];

    if (!row) throw new Error("quotation insert returned no row");

    return decodeQuotation(row);
  }

  async loadForUpdate(
    transaction: Parameters<QuotationRepository["loadForUpdate"]>[0],
    brandId: QuotationRecord["brandId"],
    id: string,
  ): Promise<QuotationRecord | null> {
    const rows = await this.unitOfWork
      .databaseFor(transaction)
      .select()
      .from(quotations)
      .where(and(eq(quotations.brandId, brandId), eq(quotations.id, id)))
      .for("update")
      .limit(1);

    return rows[0] ? decodeQuotation(rows[0]) : null;
  }

  async transition(
    transaction: Parameters<QuotationRepository["transition"]>[0],
    transition: QuotationTransition,
  ): Promise<QuotationRecord> {
    const rows = await this.unitOfWork
      .databaseFor(transaction)
      .update(quotations)
      .set({
        state: transition.nextState,
        version: sql`${quotations.version} + 1`,
      })
      .where(
        and(
          eq(quotations.brandId, transition.brandId),
          eq(quotations.id, transition.id),
          eq(quotations.version, transition.expectedVersion),
        ),
      )
      .returning();
    const row = rows[0];

    if (!row) throw new Error("quotation version conflict");
    return decodeQuotation(row);
  }
}
