import { Award, CircleHelp, Info, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { WorkspaceState } from "../types";
import { NegotiationAudit } from "./NegotiationAudit";
import { OfferComparisonTable } from "./OfferComparisonTable";
import { SectionCard } from "./SectionCard";
import { StatePlaceholder } from "./StatePlaceholder";

export function DecisionCard({ state }: { state: WorkspaceState }) {
  const decision = state.decision;

  return (
    <SectionCard
      id="decision"
      icon={Award}
      title="Review the recommendation"
      description="Compare the offers and verify why this supplier is recommended before approving a purchase order."
    >
      {!decision ? (
        <StatePlaceholder
          icon={CircleHelp}
          title="No recommendation yet"
          description="A decision appears only after the negotiation projection contains comparable offers."
        />
      ) : (
        <div className="space-y-4">
          <Alert>
            <Info aria-hidden="true" />
            <AlertTitle>
              {decision.winnerOfferId
                ? "Recommended supplier"
                : "No eligible winner"}
            </AlertTitle>
            <AlertDescription>
              {decision.decisionRecord.rationale}
            </AlertDescription>
          </Alert>
          {state.negotiation?.reducedCompetition ? (
            <Alert>
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>
                Supplier 2 can fulfill only 60% of the order
              </AlertTitle>
              <AlertDescription>
                Its offer remains in the audit but is excluded from the
                full-order recommendation.
              </AlertDescription>
            </Alert>
          ) : null}
          {decision.decisionRecord.preferenceSensitive ? (
            <Alert>
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>Preference-sensitive result</AlertTitle>
              <AlertDescription>
                Small changes to policy weights may change the winner. Review
                the sensitivity record before committing.
              </AlertDescription>
            </Alert>
          ) : null}
          {decision.decisionRecord.warnings.length ? (
            <ul className="list-inside list-disc text-sm text-warning">
              {decision.decisionRecord.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {decision.decisionRecord.offers.length ? (
            <OfferComparisonTable decision={decision} />
          ) : (
            <p className="text-sm text-muted-foreground">
              The decision record contains no offers to compare.
            </p>
          )}
          {state.negotiation ? (
            <NegotiationAudit timeline={state.negotiation.timeline} />
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
