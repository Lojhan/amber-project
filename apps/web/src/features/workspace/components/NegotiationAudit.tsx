import { ChevronDown } from "lucide-react";
import type { Negotiation } from "../../../lib/api/contracts";
import { statusLabel } from "../workspaceView";

export function NegotiationAudit({
  timeline,
}: {
  timeline: Negotiation["timeline"];
}) {
  if (!timeline.length) return null;

  return (
    <details className="group rounded-lg border bg-muted/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-medium">
        View negotiation audit ({timeline.length})
        <ChevronDown
          className="size-4 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ol className="border-t">
        {timeline.map((entry) => (
          <li
            key={`${entry.supplierId ?? "supplier"}-${entry.round ?? "round"}-${entry.status ?? "status"}-${entry.detail ?? "detail"}`}
            className="grid gap-1 border-b px-3 py-3 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)]"
          >
            <p className="text-xs font-medium">
              {entry.actor === "brand"
                ? `Brand → Supplier ${entry.supplierId?.slice(1) ?? ""}`
                : entry.actor === "supplier" && entry.supplierId
                  ? `Supplier ${entry.supplierId.slice(1)} → Brand`
                  : "System"}
              {entry.round ? ` · round ${entry.round}` : ""}
            </p>
            <p className="min-w-0 break-words text-sm leading-5 text-muted-foreground">
              {entry.detail ?? statusLabel(entry.status)}
            </p>
          </li>
        ))}
      </ol>
    </details>
  );
}
