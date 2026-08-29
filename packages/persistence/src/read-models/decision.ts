import type { DecisionReadModel } from "@procurement/application/ports";
import type { Database } from "@procurement/db/client";
import { recommendations } from "@procurement/db/schema";
import type { BrandId } from "@procurement/domain";
import { and, eq } from "drizzle-orm";
import { json } from "./codecs.js";

export class DrizzleDecisionReadModel implements DecisionReadModel {
  constructor(private readonly db: Database) {}

  async get(brandId: BrandId, negotiationId: string) {
    const r = await this.db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.brandId, brandId),
          eq(recommendations.negotiationId, negotiationId),
        ),
      )
      .limit(1);
    const x = r[0];
    return x
      ? {
          id: x.id,
          negotiationId: x.negotiationId,
          winnerOfferId: x.winnerOfferId,
          decisionRecord: json(x.decisionRecord),
        }
      : null;
  }
}
