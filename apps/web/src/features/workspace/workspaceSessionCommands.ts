import type { RefObject } from "react";
import type { ProcurementApi } from "../../lib/api/workflow";
import type { WorkspaceProjection } from "./useWorkspaceProjection";

type SessionCommandContext = Readonly<{
  api: ProcurementApi;
  projection: WorkspaceProjection;
  issueKeys: RefObject<Map<string, string>>;
  onWorkspaceChange?: ((workspaceId: string | undefined) => void) | undefined;
}>;

const clearWorkspace = ({
  projection,
  issueKeys,
  onWorkspaceChange,
}: SessionCommandContext): void => {
  issueKeys.current.clear();
  projection.clear();
  onWorkspaceChange?.(undefined);
};

export const sessionCommands = (context: SessionCommandContext) => ({
  startAgain: (): void => clearWorkspace(context),
  reset: async (): Promise<void> => {
    context.projection.setState((state) => ({
      ...state,
      pendingAction: "reset",
      error: undefined,
    }));

    try {
      await context.api.resetChallenge();
      clearWorkspace(context);
    } catch (error) {
      context.projection.fail(error);
    }
  },
});
