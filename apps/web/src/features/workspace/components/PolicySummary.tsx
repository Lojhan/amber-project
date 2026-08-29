import { CheckCircle2, Sparkles, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { WorkspaceState } from "../types";
import { policyConfirmed } from "../workspaceView";

const weightLabels = {
  cost: "Cost",
  quality: "Quality",
  lead: "Delivery speed",
  payment: "Payment terms",
} as const;

const priorityLabels = {
  cost: "Cost",
  quality: "Quality",
  lead_time: "Delivery speed",
  payment_terms: "Payment terms",
} as const;

const percent = (value: string): string => `${Number(value) * 100}%`;

export function PolicySummary({ state }: { state: WorkspaceState }) {
  const policy = state.policyPreview;
  if (!policy) return null;
  const confirmed = policyConfirmed(state);
  const priority = policy.interpretation.primaryPriority;

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            {policy.interpretation.source === "ai"
              ? "AI interpretation"
              : "Standard buying policy"}
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {policy.interpretation.summary}
          </p>
        </div>
        <Badge variant={confirmed ? "default" : "outline"}>
          {confirmed ? <CheckCircle2 aria-hidden="true" /> : null}
          {confirmed ? "Confirmed" : "Review required"}
        </Badge>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-3">
          <dt className="text-xs text-muted-foreground">Main priority</dt>
          <dd className="mt-1 text-sm font-medium">
            {priority ? priorityLabels[priority] : "Balanced"}
          </dd>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <dt className="text-xs text-muted-foreground">Delivery limit</dt>
          <dd className="mt-1 text-sm font-medium">
            {policy.constraints.hardMaxLead
              ? `${policy.constraints.hardMaxLead} days maximum`
              : "No hard limit"}
          </dd>
        </div>
        <div className="rounded-lg border bg-background p-3 sm:col-span-1">
          <dt className="text-xs text-muted-foreground">Decision weights</dt>
          <dd className="mt-1 text-xs leading-5 text-foreground">
            {Object.entries(weightLabels)
              .map(
                ([key, label]) =>
                  `${label} ${percent(policy.weights[key as keyof typeof policy.weights])}`,
              )
              .join(" · ")}
          </dd>
        </div>
      </dl>

      {policy.interpretation.warnings.length ? (
        <Alert>
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>
            {policy.interpretation.warnings.join(" ")}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
