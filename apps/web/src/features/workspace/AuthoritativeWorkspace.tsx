import { useEffect, useState } from "react";
import type { ProcurementApi } from "../../lib/api/workflow";
import { ProcurementWorkspace } from "./ProcurementWorkspace";
import { useProcurementWorkspace } from "./useProcurementWorkspace";

type AuthoritativeWorkspaceProps = Readonly<{
  api?: ProcurementApi | undefined;
  workspaceId?: string | undefined;
  onWorkspaceChange?: ((workspaceId: string | undefined) => void) | undefined;
}>;

export function AuthoritativeWorkspace({
  api,
  workspaceId,
  onWorkspaceChange,
}: AuthoritativeWorkspaceProps) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const {
    state,
    refresh,
    upload,
    chooseScenario,
    resolveMatch,
    resolveQuantities,
    previewPolicy,
    confirmPolicy,
    startNegotiation,
    preview,
    issue,
    viewPurchaseOrder,
    startAgain,
    reset,
    sendCopilotMessage,
  } = useProcurementWorkspace({ api, workspaceId, onWorkspaceChange });
  return (
    <div data-hydrated={hydrated ? "true" : "false"}>
      <ProcurementWorkspace
        state={state}
        actions={{
          refresh: async () => {
            await refresh();
          },
          startAgain,
          reset,
          upload,
          chooseScenario,
          resolveMatch,
          resolveQuantities,
          previewPolicy,
          confirmPolicy,
          startNegotiation,
          preview,
          issue,
          viewPurchaseOrder,
          sendCopilotMessage,
        }}
      />
    </div>
  );
}
