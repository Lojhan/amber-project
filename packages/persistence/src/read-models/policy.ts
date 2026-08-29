import type { NegotiationPolicyReadModel } from "@procurement/application/ports";
import type { Database } from "@procurement/db/client";
import { quotations, quoteScenarios } from "@procurement/db/schema";
import type { BrandId } from "@procurement/domain";
import { and, eq } from "drizzle-orm";

export class DrizzleNegotiationPolicyReadModel
  implements NegotiationPolicyReadModel
{
  constructor(private readonly db: Database) {}

  async quotationNote(
    brandId: BrandId,
    quotationId: string,
    scenarioId: string,
  ) {
    const r = await this.db
      .select({ note: quotations.note })
      .from(quotations)
      .innerJoin(
        quoteScenarios,
        and(
          eq(quoteScenarios.brandId, quotations.brandId),
          eq(quoteScenarios.quotationId, quotations.id),
        ),
      )
      .where(
        and(
          eq(quotations.brandId, brandId),
          eq(quotations.id, quotationId),
          eq(quoteScenarios.id, scenarioId),
        ),
      )
      .limit(1);
    const first = r[0];
    return first?.note;
  }
}
