import { GitCompareArrows, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WorkspaceActions } from "../actions";
import type { WorkspaceState } from "../types";
import {
  includedMatches,
  matchingPending,
  recoverableExcludedMatches,
  reviewableMatches,
} from "../workspaceView";
import { MatchReviewItem } from "./MatchReviewItem";
import { SectionCard } from "./SectionCard";
import { StatePlaceholder } from "./StatePlaceholder";

type Match = NonNullable<WorkspaceState["quotation"]>["matches"][number];

const matchBadgeLabel = (
  processing: boolean,
  needsIncludedProduct: boolean,
  unresolvedCount: number,
): string => {
  if (processing) return "matching";
  if (needsIncludedProduct) return "needs a product";
  if (unresolvedCount) return `${unresolvedCount} unresolved`;

  return "resolved";
};

function MatchCardBody({
  selectedScenarioId,
  matches,
  needsIncludedProduct,
  processing,
  pending,
  resolveMatch,
}: {
  selectedScenarioId: string | undefined;
  matches: readonly Match[];
  needsIncludedProduct: boolean;
  processing: boolean;
  pending: boolean;
  resolveMatch: WorkspaceActions["resolveMatch"];
}) {
  if (processing)
    return (
      <StatePlaceholder
        icon={ListChecks}
        title="Finding catalog products"
        description="Catalog matching is still running. This page will update automatically when the review is ready."
      />
    );

  if (!selectedScenarioId)
    return (
      <StatePlaceholder
        icon={ListChecks}
        title="Confirm the spreadsheet layout first"
        description="Product candidates depend on the selected spreadsheet layout."
      />
    );

  if (matches.length)
    return (
      <div className="grid gap-3">
        {matches.map((match) => (
          <MatchReviewItem
            key={match.id}
            match={match}
            resolveMatch={resolveMatch}
            disabled={pending}
            recovering={needsIncludedProduct}
          />
        ))}
      </div>
    );

  if (needsIncludedProduct)
    return (
      <StatePlaceholder
        icon={ListChecks}
        title="No products with usable pricing"
        description="This layout contains no catalog product that can be priced safely. Reset the challenge and upload a different quotation."
      />
    );

  return (
    <StatePlaceholder
      icon={ListChecks}
      title="Product review complete"
      description="Every quoted product has a catalog decision."
    />
  );
}

export function MatchCard({
  state,
  resolveMatch,
}: {
  state: WorkspaceState;
  resolveMatch: WorkspaceActions["resolveMatch"];
}) {
  const matches = reviewableMatches(state);
  const included = includedMatches(state);
  const processing = matchingPending(state);
  const needsIncludedProduct =
    !processing &&
    Boolean(state.selectedScenarioId) &&
    matches.length === 0 &&
    included.length === 0;
  const displayedMatches = needsIncludedProduct
    ? recoverableExcludedMatches(state)
    : matches;
  const pending = state.pendingAction === "match";

  return (
    <SectionCard
      id="matching"
      icon={GitCompareArrows}
      title={
        needsIncludedProduct ? "Include a product" : "Review product matches"
      }
      description={
        needsIncludedProduct
          ? "Every product is excluded. Include at least one catalog product before preparing the negotiation."
          : "For each uncertain line, choose the correct catalog product or exclude it from negotiation."
      }
      error={
        state.error?.action === "match" ||
        state.error?.action === "scenario" ||
        state.error?.code === "order-intent-empty"
          ? state.error
          : undefined
      }
      action={
        state.selectedScenarioId ? (
          <Badge variant={displayedMatches.length ? "outline" : "default"}>
            {matchBadgeLabel(processing, needsIncludedProduct, matches.length)}
          </Badge>
        ) : undefined
      }
    >
      <MatchCardBody
        selectedScenarioId={state.selectedScenarioId}
        matches={displayedMatches}
        needsIncludedProduct={needsIncludedProduct}
        processing={processing}
        pending={pending}
        resolveMatch={resolveMatch}
      />
    </SectionCard>
  );
}
