import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { WorkspaceProblem } from "../types";

export function StepError({ error }: { error: WorkspaceProblem }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>
        {error.status ? `${error.status} · ` : ""}
        {error.title}
      </AlertTitle>
      <AlertDescription>
        <p>{error.detail}</p>
        {error.fields ? (
          <ul className="mt-2 list-inside list-disc">
            {Object.entries(error.fields).map(([field, message]) => (
              <li key={field}>
                <span className="font-mono">{field}</span>: {message}
              </li>
            ))}
          </ul>
        ) : null}
        {error.correlationId ? (
          <p className="mt-2 font-mono text-xs">
            Reference {error.correlationId}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
