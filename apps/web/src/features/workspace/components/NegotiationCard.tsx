import { Bot, Check, LoaderCircle, Scale, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspaceActions } from "../actions";
import type { WorkspaceState } from "../types";
import {
  includedMatches,
  policyConfirmed,
  reviewableMatches,
  statusLabel,
} from "../workspaceView";
import { NegotiationTimeline } from "./NegotiationTimeline";
import { PolicySummary } from "./PolicySummary";
import { SectionCard } from "./SectionCard";

type NegotiationActions = Pick<
  WorkspaceActions,
  "previewPolicy" | "confirmPolicy" | "startNegotiation"
>;

const negotiationCopy = (
  state: WorkspaceState,
  confirmed: boolean,
): { title: string; description: string } => {
  if (state.negotiation)
    return {
      title: "Negotiating with suppliers",
      description:
        "Supplier responses update automatically. The recommendation appears when comparable offers are ready.",
    };
  if (confirmed)
    return {
      title: "Start supplier negotiation",
      description:
        "The priorities are confirmed. Start the negotiation when you are ready to contact suppliers.",
    };
  if (state.policyPreview)
    return {
      title: "Confirm buying priorities",
      description:
        "Check the interpreted constraints and weights before they are used with suppliers.",
    };
  return {
    title: "Prepare the negotiation",
    description:
      "Turn the buying note into explicit priorities before contacting suppliers.",
  };
};

function PolicyControls({
  state,
  actions,
  confirmed,
}: {
  state: WorkspaceState;
  actions: NegotiationActions;
  confirmed: boolean;
}) {
  const canInterpret =
    reviewableMatches(state).length === 0 &&
    includedMatches(state).length > 0 &&
    state.quotation?.status === "READY";
  const interpreting = state.pendingAction === "policy";

  if (!state.policyPreview)
    return (
      <Button
        type="button"
        disabled={!canInterpret || interpreting}
        onClick={() => void actions.previewPolicy()}
      >
        {interpreting ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Scale aria-hidden="true" />
        )}
        {interpreting ? "Preparing priorities" : "Prepare buying priorities"}
      </Button>
    );

  if (!confirmed)
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={actions.confirmPolicy}>
          <Check aria-hidden="true" />
          Use these priorities
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canInterpret || interpreting}
          onClick={() => void actions.previewPolicy()}
        >
          {interpreting ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Scale aria-hidden="true" />
          )}
          {interpreting ? "Interpreting again" : "Interpret again"}
        </Button>
      </div>
    );

  return null;
}

function StartNegotiationButton({
  state,
  actions,
  confirmed,
}: {
  state: WorkspaceState;
  actions: NegotiationActions;
  confirmed: boolean;
}) {
  const negotiating = state.pendingAction === "negotiation";

  return (
    <Button
      type="button"
      className="w-full sm:w-auto"
      disabled={!confirmed || negotiating}
      onClick={() => void actions.startNegotiation()}
    >
      {negotiating ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <Sparkles aria-hidden="true" />
      )}
      {negotiating ? "Contacting suppliers" : "Start supplier negotiation"}
    </Button>
  );
}

export function NegotiationCard({
  state,
  actions,
}: {
  state: WorkspaceState;
  actions: NegotiationActions;
}) {
  const confirmed = policyConfirmed(state);
  const copy = negotiationCopy(state, confirmed);

  return (
    <SectionCard
      id="negotiation"
      icon={Bot}
      title={copy.title}
      description={copy.description}
      error={
        state.error?.action === "policy" ||
        state.error?.action === "negotiation"
          ? state.error
          : undefined
      }
      action={
        state.negotiation ? (
          <Badge variant="outline">
            {statusLabel(state.negotiation.status)}
          </Badge>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {state.negotiation ? (
          <NegotiationTimeline negotiation={state.negotiation} />
        ) : (
          <>
            <PolicySummary state={state} />
            <PolicyControls
              state={state}
              actions={actions}
              confirmed={confirmed}
            />
            {confirmed ? (
              <StartNegotiationButton
                state={state}
                actions={actions}
                confirmed={confirmed}
              />
            ) : null}
          </>
        )}
      </div>
    </SectionCard>
  );
}
