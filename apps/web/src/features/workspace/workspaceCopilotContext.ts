import type { WorkspaceState } from "./types";
import {
  commercialReviewLines,
  includedMatches,
  matchingPending,
  reviewableMatches,
} from "./workspaceView";

export type WorkspaceCopilotContext = Readonly<{
  step: string;
  title: string;
  description: string;
  prompts: readonly string[];
}>;

const catalogMatchingContext: WorkspaceCopilotContext = {
  step: "Catalog matching",
  title: "Finding catalog products",
  description:
    "The catalog projection is still being prepared. Product review will appear automatically when it is current.",
  prompts: [],
};

export const workspaceCopilotContext = (
  state: WorkspaceState,
): WorkspaceCopilotContext => {
  if (state.purchaseOrder)
    return {
      step: "Purchase order issued",
      title: "Order complete",
      description:
        "Review the issued order, its monetary lines, and the durable audit trail.",
      prompts: [
        "Summarize the issued purchase order.",
        "What evidence is preserved for this order?",
      ],
    };
  if (state.decision)
    return {
      step: "Decision",
      title: "Review the recommendation",
      description:
        "Understand the winning offer and the evidence behind the recommendation before approval.",
      prompts: [
        "Why was this supplier recommended?",
        "What should I verify before issuing the order?",
      ],
    };
  if (state.negotiation)
    return {
      step: "Negotiation",
      title: "Follow supplier responses",
      description:
        "Inspect offers, timeline events, and reduced-competition evidence without interrupting the run.",
      prompts: [
        "Summarize the negotiation so far.",
        "Are there any supplier or capacity risks?",
      ],
    };
  if (!state.quotation)
    return {
      step: "Upload",
      title: "Start with a supplier quotation",
      description:
        "Upload an XLSX workbook first. The copilot will then keep the same conversation through every review and approval step.",
      prompts: [],
    };
  if (!state.selectedScenarioId)
    return {
      step: "Spreadsheet layout",
      title: "Choose the quote layout",
      description:
        "Compare the detected scenarios and confirm which rows represent the supplier quotation.",
      prompts: [
        "Explain the detected spreadsheet layouts.",
        "Propose the safest scenario selection for me to review.",
      ],
    };
  if (matchingPending(state)) return catalogMatchingContext;
  if (
    reviewableMatches(state).length > 0 ||
    includedMatches(state).length === 0
  )
    return {
      step: "Product matching",
      title: "Resolve catalog matches",
      description:
        "Review uncertain identifiers and decide which quote lines belong in the order.",
      prompts: [
        "Which product matches need my attention?",
        "Propose safe product-match adjustments for me to review.",
      ],
    };
  if (commercialReviewLines(state).length > 0)
    return {
      step: "Commercial review",
      title: "Resolve commercial blockers",
      description:
        "Trace quantities and prices to workbook evidence before the negotiation can start.",
      prompts: [
        "What is blocking this quote?",
        "Propose safe commercial adjustments for me to review.",
      ],
    };

  return {
    step: "Negotiation setup",
    title: "Prepare the negotiation",
    description:
      "Review the interpreted buying policy and confirm the constraints the negotiation must respect.",
    prompts: [
      "Summarize this quote before negotiation.",
      "What should I adjust or verify before starting?",
    ],
  };
};
