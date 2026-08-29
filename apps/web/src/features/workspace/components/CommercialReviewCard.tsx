import { Ban, PackageCheck } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Quotation } from "../../../lib/api/contracts";
import type { WorkspaceActions } from "../actions";
import type { WorkspaceState } from "../types";
import { commercialReviewLines } from "../workspaceView";
import { SectionCard } from "./SectionCard";
import { StepActions } from "./StepActions";

type ReviewLine = Quotation["matches"][number];

const positiveInteger = /^[1-9]\d*$/;
const maximumQuantity = 9_223_372_036_854_775_807n;

const needsQuantity = (line: ReviewLine): boolean =>
  line.reviewReasons.includes("missing_requested_quantity") ||
  line.reviewReasons.includes("no_price_for_requested_quantity");

const validQuantity = (value: string, minimum?: string): boolean => {
  if (!positiveInteger.test(value)) return false;

  const quantity = BigInt(value);
  return (
    quantity <= maximumQuantity && (!minimum || quantity >= BigInt(minimum))
  );
};

const reasonFor = (line: ReviewLine): string => {
  if (line.reviewReasons.includes("missing_unit_price"))
    return "No usable unit price was found for this line.";
  if (line.reviewReasons.includes("ambiguous_commercial_fields"))
    return "The workbook columns for this line could not be interpreted safely.";
  if (line.reviewReasons.includes("no_price_for_requested_quantity"))
    return `The requested quantity is below the first quoted tier${
      line.minimumOrderQuantity ? ` of ${line.minimumOrderQuantity} units` : ""
    }.`;
  return "The workbook provides price tiers but does not say how many units to order.";
};

const commonMinimumFor = (lines: readonly ReviewLine[]): string | undefined => {
  const minimums = new Set(
    lines.flatMap((line) =>
      line.minimumOrderQuantity ? [line.minimumOrderQuantity] : [],
    ),
  );

  return minimums.size === 1 && lines.every((line) => line.minimumOrderQuantity)
    ? [...minimums][0]
    : undefined;
};

function BulkQuantityControl({
  value,
  disabled,
  commonMinimum,
  onChange,
  onApply,
}: {
  value: string;
  disabled: boolean;
  commonMinimum?: string | undefined;
  onChange: (value: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/15 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="grid gap-2">
        <Label htmlFor="quantity-for-all">Use one quantity for all</Label>
        <Input
          id="quantity-for-all"
          inputMode="numeric"
          pattern="[1-9][0-9]*"
          placeholder="For example, 1000"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        {commonMinimum ? (
          <p className="text-xs text-muted-foreground">
            Every line starts at a quoted tier of {commonMinimum} units.
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={!positiveInteger.test(value) || disabled}
        onClick={onApply}
      >
        Apply to all
      </Button>
    </div>
  );
}

function CommercialReviewLine({
  line,
  quantity,
  disabled,
  commonMinimum,
  onQuantityChange,
  onExclude,
}: {
  line: ReviewLine;
  quantity: string;
  disabled: boolean;
  commonMinimum?: string | undefined;
  onQuantityChange: (value: string) => void;
  onExclude: () => void;
}) {
  const editable = needsQuantity(line);
  const invalid =
    editable &&
    quantity.length > 0 &&
    !validQuantity(quantity, line.minimumOrderQuantity);
  const exceptionalReason = line.reviewReasons.some(
    (reason) => reason !== "missing_requested_quantity",
  );

  return (
    <article className="grid gap-3 bg-muted/10 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(160px,220px)] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm font-medium">{line.label}</p>
        {exceptionalReason ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {reasonFor(line)}
          </p>
        ) : null}
        {!editable ? (
          <Button
            className="mt-3"
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={onExclude}
          >
            <Ban aria-hidden="true" />
            Exclude line
          </Button>
        ) : null}
      </div>
      {editable ? (
        <div className="grid gap-2">
          <Label htmlFor={`quantity-${line.lineId}`}>Requested quantity</Label>
          <Input
            id={`quantity-${line.lineId}`}
            aria-invalid={invalid}
            inputMode="numeric"
            pattern="[1-9][0-9]*"
            value={quantity}
            disabled={disabled}
            onChange={(event) => onQuantityChange(event.target.value)}
          />
          {!commonMinimum || line.minimumOrderQuantity !== commonMinimum ? (
            <p className="text-xs text-muted-foreground">
              {line.minimumOrderQuantity
                ? `Minimum quoted tier: ${line.minimumOrderQuantity}`
                : "Enter a positive whole number"}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

const commercialReviewCopy = (onlyUnsafeEvidence: boolean) =>
  onlyUnsafeEvidence
    ? {
        title: "Resolve unsafe quote lines",
        description:
          "These lines contain ambiguous or missing commercial evidence. Exclude any line that cannot be priced safely.",
      }
    : {
        title: "Add requested quantities",
        description:
          "Choose how many units to buy. We will apply the correct quoted price tier to each line.",
      };

export function CommercialReviewCard({
  state,
  resolveQuantities,
  resolveMatch,
}: {
  state: WorkspaceState;
  resolveQuantities: WorkspaceActions["resolveQuantities"];
  resolveMatch: WorkspaceActions["resolveMatch"];
}) {
  const lines = commercialReviewLines(state);
  const editableLines = lines.filter(needsQuantity);
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      editableLines.map((line) => [line.lineId, line.requestedQuantity ?? ""]),
    ),
  );
  const [bulkQuantity, setBulkQuantity] = useState("");
  const commonMinimum = commonMinimumFor(editableLines);
  const pending =
    state.pendingAction === "commercial-review" ||
    state.pendingAction === "match";
  const allValid = editableLines.every((line) =>
    validQuantity(quantities[line.lineId] ?? "", line.minimumOrderQuantity),
  );
  const onlyUnsafeEvidence = editableLines.length === 0;
  const copy = commercialReviewCopy(onlyUnsafeEvidence);

  const submit = () =>
    resolveQuantities(
      editableLines.map((line) => ({
        parsedLineId: line.lineId,
        requestedQuantity: quantities[line.lineId] ?? "",
      })),
    );

  return (
    <SectionCard
      id="commercial-review"
      icon={PackageCheck}
      title={copy.title}
      description={copy.description}
      error={
        state.error?.action === "commercial-review" ||
        state.error?.action === "match"
          ? state.error
          : undefined
      }
      action={<Badge variant="outline">{lines.length} to review</Badge>}
    >
      <div className="grid gap-5">
        {editableLines.length > 1 ? (
          <BulkQuantityControl
            value={bulkQuantity}
            disabled={pending}
            commonMinimum={commonMinimum}
            onChange={setBulkQuantity}
            onApply={() =>
              setQuantities(
                Object.fromEntries(
                  editableLines.map((line) => [line.lineId, bulkQuantity]),
                ),
              )
            }
          />
        ) : null}

        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="divide-y overflow-hidden rounded-lg border">
            {lines.map((line) => (
              <CommercialReviewLine
                key={line.lineId}
                line={line}
                quantity={quantities[line.lineId] ?? ""}
                disabled={pending}
                commonMinimum={commonMinimum}
                onQuantityChange={(value) =>
                  setQuantities((current) => ({
                    ...current,
                    [line.lineId]: value,
                  }))
                }
                onExclude={() => void resolveMatch(line.id, "exclude")}
              />
            ))}
          </div>

          {editableLines.length ? (
            <StepActions>
              <Button
                className="w-full sm:w-auto"
                type="submit"
                disabled={!allValid || pending}
              >
                {pending
                  ? "Saving quantities…"
                  : "Save quantities and continue"}
              </Button>
            </StepActions>
          ) : (
            <Alert>
              <PackageCheck aria-hidden="true" />
              <AlertTitle>These lines cannot be priced safely</AlertTitle>
              <AlertDescription>
                Exclude them from this negotiation to continue.
              </AlertDescription>
            </Alert>
          )}
        </form>
      </div>
    </SectionCard>
  );
}
