import { CheckCircle2, Clock3, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { Negotiation } from "../../../lib/api/contracts";
import { statusLabel } from "../workspaceView";
import { NegotiationAudit } from "./NegotiationAudit";

const suppliers = ["S1", "S2", "S3"] as const;

export function NegotiationTimeline({
  negotiation,
}: {
  negotiation: Negotiation;
}) {
  return (
    <div className="space-y-4">
      {negotiation.reducedCompetition ? (
        <Alert>
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Supplier 2 can fulfill only 60% of the order</AlertTitle>
          <AlertDescription>
            Its offer stays in the audit record but is excluded from the final
            full-order recommendation.
          </AlertDescription>
        </Alert>
      ) : null}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Supplier responses</p>
          <Badge variant="outline">{statusLabel(negotiation.status)}</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {suppliers.map((supplierId) => {
            const responses = negotiation.timeline.filter(
              (entry) => entry.supplierId === supplierId,
            );
            const offers = negotiation.offers.filter(
              (offer) => offer.supplierId === supplierId,
            );
            const latest = [...offers].sort((a, b) => b.round - a.round)[0];

            return (
              <div
                key={supplierId}
                className="rounded-lg border bg-background p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Supplier {supplierId.slice(1)}
                  </p>
                  {latest ? (
                    <CheckCircle2
                      className="size-4 text-primary"
                      aria-label="Responded"
                    />
                  ) : (
                    <Clock3
                      className="size-4 text-muted-foreground"
                      aria-label="Waiting"
                    />
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {latest
                    ? `Latest offer: round ${latest.round} · ${latest.leadTimeDays} day delivery`
                    : responses.length
                      ? `${responses.length} response${responses.length === 1 ? "" : "s"} received`
                      : "Waiting for a response"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {negotiation.timeline.length ? (
        <NegotiationAudit timeline={negotiation.timeline} />
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Requests have been sent. Responses will appear here automatically.
        </p>
      )}
    </div>
  );
}
