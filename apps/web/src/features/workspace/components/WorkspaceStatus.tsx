import { AlertCircle, RefreshCw, Wifi } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { WorkspaceState } from "../types";

export function WorkspaceStatus({
  state,
  refresh,
}: {
  state: WorkspaceState;
  refresh: () => Promise<void>;
}) {
  const workspaceError = state.error?.action ? undefined : state.error;
  if (!workspaceError && !state.stale) return null;

  return (
    <div className="grid gap-3" aria-live="polite">
      {workspaceError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>
            {workspaceError.status ? `${workspaceError.status} · ` : ""}
            {workspaceError.title}
          </AlertTitle>
          <AlertDescription>
            <p>{workspaceError.detail}</p>
            {workspaceError.fields ? (
              <ul className="mt-2 list-inside list-disc">
                {Object.entries(workspaceError.fields).map(
                  ([field, message]) => (
                    <li key={field}>
                      <span className="font-mono">{field}</span>: {message}
                    </li>
                  ),
                )}
              </ul>
            ) : null}
            {workspaceError.correlationId ? (
              <p className="mt-2 font-mono text-xs">
                Reference {workspaceError.correlationId}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void refresh()}
            >
              <RefreshCw aria-hidden="true" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {state.stale ? (
        <Alert>
          <Wifi aria-hidden="true" />
          <AlertTitle>Refreshing newer evidence</AlertTitle>
          <AlertDescription>
            A server event invalidated this view. The latest projection is being
            loaded.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
