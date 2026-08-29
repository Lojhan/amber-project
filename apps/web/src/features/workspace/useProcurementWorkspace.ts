import { useRef } from "react";
import { ProcurementApi } from "../../lib/api/workflow";
import { useWorkspaceCommands } from "./useWorkspaceCommands";
import { useWorkspaceProjection } from "./useWorkspaceProjection";

type ProcurementWorkspaceOptions = Readonly<{
  api?: ProcurementApi | undefined;
  workspaceId?: string | undefined;
  onWorkspaceChange?: ((workspaceId: string | undefined) => void) | undefined;
}>;

export const useProcurementWorkspace = (
  options: ProcurementWorkspaceOptions = {},
) => {
  const defaultApi = useRef<ProcurementApi | undefined>(undefined);
  defaultApi.current ??= new ProcurementApi();
  const api = options.api ?? defaultApi.current;
  const projection = useWorkspaceProjection(api, options.workspaceId);
  const commands = useWorkspaceCommands(
    api,
    projection,
    options.onWorkspaceChange,
  );

  return { state: projection.state, refresh: projection.refresh, ...commands };
};
