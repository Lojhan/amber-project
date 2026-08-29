import { randomUUID } from "node:crypto";
import { ApplicationError } from "@procurement/application";
import type {
  MatchCandidateFact,
  MatchCandidateInput,
  MatchingRepository,
  MatchResolution,
} from "@procurement/application/ports";
import type { DatabaseTransaction } from "@procurement/db";
import {
  matchDecisions,
  parsedQuoteLines,
  products,
  quotations,
  quoteScenarios,
} from "@procurement/db/schema";
import type { BrandId } from "@procurement/domain";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";
import {
  asRecord,
  candidateField,
  selectedProductId,
} from "./matching-codecs.js";
import { loadMatchResolutionSummary } from "./matching-unresolved.js";

/** Typed Drizzle adapter for append-only catalog matching facts and resolutions. */
export class DrizzleMatchingRepository implements MatchingRepository {
  constructor(private readonly unitOfWork: DrizzleUnitOfWork) {}

  async listCandidateInputs(
    transaction: Parameters<MatchingRepository["listCandidateInputs"]>[0],
    brandId: BrandId,
    quotationId: string,
  ) {
    const database = this.unitOfWork.databaseFor(transaction);
    const rows = await database
      .select({
        id: parsedQuoteLines.id,
        catalogVersion: quotations.catalogVersion,
        normalizedCandidates: parsedQuoteLines.normalizedCandidates,
      })
      .from(parsedQuoteLines)
      .innerJoin(
        quoteScenarios,
        and(
          eq(quoteScenarios.brandId, parsedQuoteLines.brandId),
          eq(quoteScenarios.id, parsedQuoteLines.scenarioId),
        ),
      )
      .innerJoin(
        quotations,
        and(
          eq(quotations.brandId, quoteScenarios.brandId),
          eq(quotations.id, quoteScenarios.quotationId),
        ),
      )
      .leftJoin(
        matchDecisions,
        and(
          eq(matchDecisions.brandId, parsedQuoteLines.brandId),
          eq(matchDecisions.parsedLineId, parsedQuoteLines.id),
        ),
      )
      .where(
        and(
          eq(parsedQuoteLines.brandId, brandId),
          eq(quoteScenarios.quotationId, quotationId),
          isNull(matchDecisions.id),
        ),
      );

    return rows.map((line): MatchCandidateInput => {
      const candidate: {
        parsedLineId: string;
        catalogVersion: string;
        rawSku: string;
        description?: string;
        color?: string;
        size?: string;
      } = {
        parsedLineId: line.id,
        catalogVersion: line.catalogVersion,
        rawSku: candidateField(line.normalizedCandidates, "sku") ?? "",
      };
      const description = candidateField(
        line.normalizedCandidates,
        "description",
      );
      const color = candidateField(line.normalizedCandidates, "color");
      const size = candidateField(line.normalizedCandidates, "size");
      if (description !== undefined) candidate.description = description;
      if (color !== undefined) candidate.color = color;
      if (size !== undefined) candidate.size = size;
      return candidate;
    });
  }

  async appendCandidate(
    transaction: Parameters<MatchingRepository["appendCandidate"]>[0],
    candidate: MatchCandidateFact,
  ): Promise<void> {
    await this.unitOfWork
      .databaseFor(transaction)
      .insert(matchDecisions)
      .values({
        id: randomUUID(),
        brandId: candidate.brandId,
        parsedLineId: candidate.parsedLineId,
        candidates: candidate.candidates,
        selectedProductId: candidate.selectedProductId ?? null,
        actorId: null,
      })
      .onConflictDoNothing({
        target: [matchDecisions.brandId, matchDecisions.parsedLineId],
        where: isNull(matchDecisions.actorId),
      });
  }

  async resolve(
    transaction: Parameters<MatchingRepository["resolve"]>[0],
    resolution: MatchResolution,
  ): Promise<{ scenarioId: string }> {
    const database = this.unitOfWork.databaseFor(transaction);
    const match = await this.loadResolutionMatch(database, resolution);
    await this.assertLatestMatch(database, resolution, match.parsedLineId);

    const productId = selectedProductId(resolution, match.candidates);
    if (!productId && resolution.action !== "exclude")
      throw new ApplicationError(
        "candidate-required",
        422,
        "Choose a catalog candidate before accepting",
      );
    if (productId)
      await this.assertCatalogProduct(
        database,
        resolution.brandId,
        match.catalogVersion,
        productId,
      );

    await this.appendResolution(
      database,
      resolution,
      match.parsedLineId,
      match.candidates,
      productId,
    );

    return { scenarioId: match.scenarioId };
  }

  private async loadResolutionMatch(
    database: DatabaseTransaction,
    resolution: MatchResolution,
  ) {
    const matches = await database
      .select({
        parsedLineId: matchDecisions.parsedLineId,
        candidates: matchDecisions.candidates,
        scenarioId: quoteScenarios.id,
        catalogVersion: quotations.catalogVersion,
      })
      .from(matchDecisions)
      .innerJoin(
        parsedQuoteLines,
        and(
          eq(parsedQuoteLines.brandId, matchDecisions.brandId),
          eq(parsedQuoteLines.id, matchDecisions.parsedLineId),
        ),
      )
      .innerJoin(
        quoteScenarios,
        and(
          eq(quoteScenarios.brandId, parsedQuoteLines.brandId),
          eq(quoteScenarios.id, parsedQuoteLines.scenarioId),
        ),
      )
      .innerJoin(
        quotations,
        and(
          eq(quotations.brandId, quoteScenarios.brandId),
          eq(quotations.id, quoteScenarios.quotationId),
        ),
      )
      .where(
        and(
          eq(matchDecisions.brandId, resolution.brandId),
          eq(matchDecisions.id, resolution.matchId),
          eq(quoteScenarios.quotationId, resolution.quotationId),
          eq(quoteScenarios.id, resolution.scenarioId),
        ),
      )
      // Locks this fact so two resolution attempts cannot both append decisions.
      .for("update")
      .limit(1);
    const match = matches[0];
    if (!match)
      throw new ApplicationError("match-not-found", 404, "Match was not found");
    return match;
  }

  private async assertLatestMatch(
    database: DatabaseTransaction,
    resolution: MatchResolution,
    parsedLineId: string,
  ): Promise<void> {
    const latest = await database
      .select({ id: matchDecisions.id })
      .from(matchDecisions)
      .where(
        and(
          eq(matchDecisions.brandId, resolution.brandId),
          eq(matchDecisions.parsedLineId, parsedLineId),
        ),
      )
      .orderBy(desc(matchDecisions.createdAt), desc(matchDecisions.id))
      .limit(1);
    if (latest[0]?.id !== resolution.matchId)
      throw new ApplicationError("match-not-found", 404, "Match was not found");
  }

  private async assertCatalogProduct(
    database: DatabaseTransaction,
    brandId: BrandId,
    catalogVersion: string,
    productId: string,
  ): Promise<void> {
    const product = await database
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.brandId, brandId),
          eq(products.catalogVersion, catalogVersion),
          eq(products.id, productId),
        ),
      )
      .limit(1);
    if (!product[0])
      throw new ApplicationError(
        "catalog-product-not-found",
        422,
        "Product is outside this catalog",
      );
  }

  private async appendResolution(
    database: DatabaseTransaction,
    resolution: MatchResolution,
    parsedLineId: string,
    candidates: unknown,
    selectedProductId: string | undefined,
  ) {
    await database.insert(matchDecisions).values({
      id: randomUUID(),
      brandId: resolution.brandId,
      parsedLineId,
      candidates: {
        ...asRecord(candidates),
        resolution: {
          rationale: resolution.rationale ?? null,
          action: resolution.action,
          actorId: resolution.actorId,
        },
      },
      selectedProductId: selectedProductId ?? null,
      excluded: resolution.action === "exclude",
      actorId: resolution.actorId,
    });
  }

  async resolutionSummary(
    transaction: Parameters<MatchingRepository["resolutionSummary"]>[0],
    brandId: BrandId,
    quotationId: string,
    scenarioId: string,
  ) {
    return loadMatchResolutionSummary(
      this.unitOfWork.databaseFor(transaction),
      brandId,
      quotationId,
      scenarioId,
    );
  }
}
