import type { ActorId, BrandId } from "@procurement/domain";
import type { TransactionContext } from "../core/transaction-context.js";
import type { JsonValue } from "./json.js";

export type MatchCandidateInput = Readonly<{
  parsedLineId: string;
  catalogVersion: string;
  rawSku: string;
  description?: string;
  color?: string;
  size?: string;
}>;

export type CatalogProduct = Readonly<{
  id: string;
  sku: string;
  name: string | null;
  color: string | null;
}>;

export type MatchCandidateFact = Readonly<{
  brandId: BrandId;
  parsedLineId: string;
  candidates: JsonValue;
  selectedProductId?: string;
}>;

export type MatchResolution = Readonly<{
  brandId: BrandId;
  actorId: ActorId;
  quotationId: string;
  scenarioId: string;
  matchId: string;
  action: "accept" | "select" | "exclude";
  selectedProductId?: string;
  rationale?: string;
}>;

export type MatchResolutionSummary = Readonly<{
  unresolved: number;
  included: number;
}>;

export interface MatchingRepository {
  listCandidateInputs(
    transaction: TransactionContext,
    brandId: BrandId,
    quotationId: string,
  ): Promise<readonly MatchCandidateInput[]>;
  appendCandidate(
    transaction: TransactionContext,
    candidate: MatchCandidateFact,
  ): Promise<void>;
  resolve(
    transaction: TransactionContext,
    resolution: MatchResolution,
  ): Promise<{ scenarioId: string }>;
  resolutionSummary(
    transaction: TransactionContext,
    brandId: BrandId,
    quotationId: string,
    scenarioId: string,
  ): Promise<MatchResolutionSummary>;
}

/** Stores the user's explicit scenario choice independently of match resolution. */
export interface ScenarioSelectionRepository {
  selectedScenario(
    transaction: TransactionContext,
    brandId: BrandId,
    quotationId: string,
  ): Promise<string | null>;
  selectScenario(
    transaction: TransactionContext,
    input: Readonly<{
      brandId: BrandId;
      quotationId: string;
      scenarioId: string;
      actorId: ActorId;
    }>,
  ): Promise<boolean>;
}

export interface CatalogRepository {
  currentVersion(
    transaction: TransactionContext,
    brandId: BrandId,
  ): Promise<string | null>;
  listVersion(
    transaction: TransactionContext,
    brandId: BrandId,
    catalogVersion: string,
  ): Promise<readonly CatalogProduct[]>;
}
