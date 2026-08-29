import type { WorkspaceState } from "./types";

export const initialWorkspaceState: WorkspaceState = {
  loading: true,
  stale: false,
  copilotPending: false,
  purchaseOrders: [],
};

export const updateWorkspaceState = (
  current: WorkspaceState,
  patch: Partial<WorkspaceState>,
): WorkspaceState => ({ ...current, ...patch });
