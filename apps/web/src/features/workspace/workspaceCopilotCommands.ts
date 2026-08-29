import { ApiError } from "../../lib/api/client";
import type { ProcurementApi } from "../../lib/api/workflow";
import type { WorkspaceProblem } from "./types";
import type { WorkspaceProjection } from "./useWorkspaceProjection";

const copilotProblem = (error: unknown): WorkspaceProblem =>
  error instanceof ApiError
    ? {
        title: error.problem.title,
        detail: error.problem.detail,
        status: error.problem.status,
        code: error.problem.code,
        correlationId: error.problem.correlationId,
      }
    : {
        title: "Copilot unavailable",
        detail:
          error instanceof Error
            ? error.message
            : "The quote copilot could not respond.",
      };

export const copilotCommands = (
  api: ProcurementApi,
  projection: WorkspaceProjection,
) => ({
  sendCopilotMessage: async (message: string) => {
    const quotation = projection.state.quotation;
    const content = message.trim();
    if (!quotation || !content) return;
    const optimisticMessage = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content,
      suggestions: [],
      createdAt: new Date().toISOString(),
    };
    projection.setState((state) => ({
      ...state,
      copilot: {
        quotationId: quotation.id,
        messages: [...(state.copilot?.messages ?? []), optimisticMessage],
      },
      copilotPending: true,
      copilotStreamingContent: undefined,
      copilotError: undefined,
    }));

    try {
      const copilot = await api.streamQuoteCopilot(
        {
          quotationId: quotation.id,
          message: content,
        },
        (streamedContent) =>
          projection.setState((state) => ({
            ...state,
            copilotStreamingContent: streamedContent,
          })),
      );
      projection.setState((state) => ({
        ...state,
        copilot,
        copilotPending: false,
        copilotStreamingContent: undefined,
      }));
    } catch (error) {
      projection.setState((state) => ({
        ...state,
        copilotPending: false,
        copilotStreamingContent: undefined,
        copilotError: copilotProblem(error),
      }));
    }
  },
});
