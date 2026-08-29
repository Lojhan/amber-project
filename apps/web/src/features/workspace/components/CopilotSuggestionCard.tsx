import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuoteCopilotConversation } from "../../../lib/api/contracts";
import type { WorkspaceActions } from "../actions";
import type { WorkspaceState } from "../types";

type Suggestion =
  QuoteCopilotConversation["messages"][number]["suggestions"][number];

const selectedLines = (state: WorkspaceState) =>
  state.quotation?.matches.filter(
    (line) => line.scenarioId === state.selectedScenarioId,
  ) ?? [];

const canApply = (state: WorkspaceState, suggestion: Suggestion): boolean => {
  if (state.quotation?.negotiationId) return false;
  if (suggestion.kind === "select_scenario")
    return Boolean(
      state.quotation?.scenarios.some(
        (scenario) => scenario.id === suggestion.scenarioId,
      ),
    );
  if (suggestion.kind === "set_quantity")
    return selectedLines(state).some(
      (line) =>
        line.matchReady &&
        line.lineId === suggestion.lineId &&
        line.status !== "EXCLUDED",
    );

  const line = selectedLines(state).find(
    (candidate) => candidate.id === suggestion.matchId,
  );
  if (!line?.matchReady) return false;
  if (suggestion.kind === "exclude_line") return line.status !== "EXCLUDED";

  return line.candidates.some(
    (candidate) => candidate.productId === suggestion.productId,
  );
};

const applySuggestion = async (
  suggestion: Suggestion,
  actions: WorkspaceActions,
): Promise<void> => {
  if (suggestion.kind === "select_scenario")
    return actions.chooseScenario(suggestion.scenarioId);
  if (suggestion.kind === "set_quantity")
    return actions.resolveQuantities([
      {
        parsedLineId: suggestion.lineId,
        requestedQuantity: suggestion.quantity,
      },
    ]);
  if (suggestion.kind === "exclude_line")
    return actions.resolveMatch(suggestion.matchId, "exclude");

  return actions.resolveMatch(
    suggestion.matchId,
    "select",
    suggestion.productId,
  );
};

export function CopilotSuggestionCard({
  suggestion,
  state,
  actions,
}: {
  suggestion: Suggestion;
  state: WorkspaceState;
  actions: WorkspaceActions;
}) {
  const applicable = canApply(state, suggestion);

  return (
    <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
      <div>
        <p className="text-sm font-medium">{suggestion.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {suggestion.explanation}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="justify-self-start"
        disabled={!applicable || Boolean(state.pendingAction)}
        onClick={() => void applySuggestion(suggestion, actions)}
      >
        <Check aria-hidden="true" />
        {applicable ? "Review and apply" : "No longer applicable"}
      </Button>
    </div>
  );
}
