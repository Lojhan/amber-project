import type { WorkspaceActions } from "./actions";
import { ChallengeResetControl } from "./components/ChallengeResetControl";
import { CommercialReviewCard } from "./components/CommercialReviewCard";
import { DecisionCard } from "./components/DecisionCard";
import { MatchCard } from "./components/MatchCard";
import { NegotiationCard } from "./components/NegotiationCard";
import { PurchaseOrderCard } from "./components/PurchaseOrderCard";
import { PurchaseOrderHistory } from "./components/PurchaseOrderHistory";
import { ScenarioCard } from "./components/ScenarioCard";
import { UploadCard } from "./components/UploadCard";
import { WorkspaceCopilot } from "./components/WorkspaceCopilot";
import { WorkspaceSkeleton } from "./components/WorkspaceSkeleton";
import { WorkspaceStatus } from "./components/WorkspaceStatus";
import type { WorkspaceState } from "./types";
import {
  commercialReviewLines,
  includedMatches,
  matchingPending,
  reviewableMatches,
} from "./workspaceView";

function CurrentWorkspaceStep({
  state,
  actions,
}: {
  state: WorkspaceState;
  actions: WorkspaceActions;
}) {
  if (state.purchaseOrder)
    return <PurchaseOrderCard state={state} actions={actions} />;
  if (state.decision) return <DecisionCard state={state} />;
  if (state.negotiation)
    return <NegotiationCard state={state} actions={actions} />;

  const matches = reviewableMatches(state);
  const included = includedMatches(state);
  const commercialLines = commercialReviewLines(state);
  const matching = matchingPending(state);

  const readyToNegotiate =
    state.selectedScenarioId &&
    !matching &&
    state.quotation?.status === "READY" &&
    matches.length === 0 &&
    included.length > 0 &&
    commercialLines.length === 0;
  if (readyToNegotiate)
    return <NegotiationCard state={state} actions={actions} />;
  if (state.selectedScenarioId && matching)
    return <MatchCard state={state} resolveMatch={actions.resolveMatch} />;
  if (state.selectedScenarioId && matches.length > 0)
    return <MatchCard state={state} resolveMatch={actions.resolveMatch} />;
  if (state.selectedScenarioId && included.length === 0)
    return <MatchCard state={state} resolveMatch={actions.resolveMatch} />;
  if (state.selectedScenarioId && commercialLines.length > 0)
    return (
      <CommercialReviewCard
        state={state}
        resolveQuantities={actions.resolveQuantities}
        resolveMatch={actions.resolveMatch}
      />
    );
  if (state.selectedScenarioId)
    return <MatchCard state={state} resolveMatch={actions.resolveMatch} />;
  if (state.quotation)
    return (
      <ScenarioCard state={state} chooseScenario={actions.chooseScenario} />
    );
  return <UploadCard state={state} upload={actions.upload} />;
}

export function ProcurementWorkspace({
  state,
  actions,
}: {
  state: WorkspaceState;
  actions: WorkspaceActions;
}) {
  if (state.loading && !state.quotation) return <WorkspaceSkeleton />;

  const decisionReady = Boolean(state.decision && !state.purchaseOrder);

  return (
    <div aria-busy={Boolean(state.pendingAction)}>
      <div
        className={`mx-auto grid gap-4 ${decisionReady ? "max-w-7xl" : "max-w-5xl"}`}
      >
        <ChallengeResetControl state={state} reset={actions.reset} />
        <WorkspaceStatus state={state} refresh={actions.refresh} />
        <div
          className={
            decisionReady
              ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]"
              : "grid gap-4"
          }
        >
          {!state.stale ? (
            <div className="grid min-w-0 gap-4">
              <CurrentWorkspaceStep state={state} actions={actions} />
            </div>
          ) : null}
          {decisionReady ? (
            <aside className="grid min-w-0 gap-4 lg:sticky lg:top-4">
              <PurchaseOrderCard state={state} actions={actions} />
            </aside>
          ) : null}
        </div>
      </div>
      <PurchaseOrderHistory
        state={state}
        viewPurchaseOrder={actions.viewPurchaseOrder}
      />
      <WorkspaceCopilot state={state} actions={actions} />
    </div>
  );
}
