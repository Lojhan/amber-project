import { FileQuestion, ScanSearch } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { WorkspaceActions } from "../actions";
import type { WorkspaceState } from "../types";
import { SectionCard } from "./SectionCard";
import { StatePlaceholder } from "./StatePlaceholder";

export function ScenarioCard({
  state,
  chooseScenario,
}: {
  state: WorkspaceState;
  chooseScenario: WorkspaceActions["chooseScenario"];
}) {
  const scenarios = state.quotation?.scenarios ?? [];
  const pending = state.pendingAction === "scenario";

  return (
    <SectionCard
      id="interpretation"
      icon={ScanSearch}
      title="Confirm the spreadsheet layout"
      description={
        scenarios.length === 1
          ? "Confirm that the detected layout matches the supplier's quotation."
          : `We found ${scenarios.length} possible layouts. Choose the one that matches the supplier's quotation.`
      }
      error={state.error?.action === "scenario" ? state.error : undefined}
    >
      {scenarios.length ? (
        <RadioGroup
          aria-label="Select one parsed scenario"
          value={state.selectedScenarioId ?? null}
          disabled={pending}
          onValueChange={(id) => void chooseScenario(id)}
          className="gap-3"
        >
          {scenarios.map((scenario, index) => {
            const id = `scenario-${scenario.id}`;
            return (
              <Label
                key={scenario.id}
                htmlFor={id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors has-data-checked:border-primary/60 has-data-checked:bg-primary/5 hover:bg-muted/40"
              >
                <RadioGroupItem
                  id={id}
                  value={scenario.id}
                  className="mt-0.5"
                />
                <span className="min-w-0 space-y-1">
                  <span className="block text-sm font-medium">
                    {scenario.label || `Option ${index + 1}`}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {scenario.evidence ??
                      `Detected layout ${index + 1}; product matches will be reviewed next.`}
                  </span>
                </span>
              </Label>
            );
          })}
        </RadioGroup>
      ) : (
        <StatePlaceholder
          icon={FileQuestion}
          title="Waiting for parsed evidence"
          description="Scenarios appear after an uploaded workbook reaches an authoritative parse state."
        />
      )}
    </SectionCard>
  );
}
