import { Ban, Check, PackageSearch } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Quotation } from "../../../lib/api/contracts";
import type { WorkspaceActions } from "../actions";

type Match = Quotation["matches"][number];

const confidence = (score: number): string => `${Math.round(score * 100)}%`;

export function MatchReviewItem({
  match,
  resolveMatch,
  disabled,
  recovering = false,
}: {
  match: Match;
  resolveMatch: WorkspaceActions["resolveMatch"];
  disabled: boolean;
  recovering?: boolean;
}) {
  const [productId, setProductId] = useState(
    match.candidates[0]?.productId ?? "",
  );
  const selected = match.candidates.find(
    (candidate) => candidate.productId === productId,
  );

  return (
    <article className="rounded-lg border bg-muted/15 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <PackageSearch
            className="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <h3 className="truncate font-mono text-sm font-medium">
            {match.label}
          </h3>
        </div>
        <Badge variant="outline">
          {recovering ? "excluded" : "needs a decision"}
        </Badge>
      </div>
      {match.candidates.length ? (
        <div className="space-y-3">
          <Select
            value={productId}
            onValueChange={setProductId}
            disabled={disabled}
          >
            <SelectTrigger
              className="w-full"
              aria-label={`Catalog match for ${match.label}`}
            >
              <SelectValue placeholder="Choose a catalog candidate" />
            </SelectTrigger>
            <SelectContent>
              {match.candidates.map((candidate) => (
                <SelectItem
                  key={candidate.productId}
                  value={candidate.productId}
                >
                  {candidate.sku} · {candidate.name ?? "Unnamed product"} ·{" "}
                  {confidence(candidate.score)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected ? (
            <div className="grid gap-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Match confidence</span>
                <span className="font-mono">{confidence(selected.score)}</span>
              </div>
              <Progress value={selected.score * 100} />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No defensible catalog candidate was found. Exclude this line before
          negotiation.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {match.candidates.length ? (
          <Button
            type="button"
            size="sm"
            disabled={disabled || !productId}
            aria-label={`${recovering ? "Include product" : "Use this product"} for ${match.label}`}
            onClick={() => void resolveMatch(match.id, "select", productId)}
          >
            <Check aria-hidden="true" />
            {recovering ? "Include this product" : "Use this product"}
          </Button>
        ) : null}
        {!recovering ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            aria-label={`Exclude ${match.label}`}
            onClick={() => void resolveMatch(match.id, "exclude")}
          >
            <Ban aria-hidden="true" />
            Exclude line
          </Button>
        ) : null}
      </div>
    </article>
  );
}
