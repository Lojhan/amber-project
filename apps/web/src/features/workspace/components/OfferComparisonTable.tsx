import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Decision } from "../../../lib/api/contracts";
import { formatMoney } from "../formatMoney";

const supplierName = (id: string): string =>
  id.startsWith("S") ? `Supplier ${id.slice(1)}` : id;

const exclusionLabel = (reason: string): string => {
  if (reason === "capacity_not_full") return "Cannot fulfill full order";
  if (reason === "lead_exceeds_hard_maximum") return "Delivery exceeds limit";
  return reason.replaceAll("_", " ");
};

const scoreLabel = (score: string | undefined): string =>
  score === undefined
    ? "Score pending"
    : `Score ${Math.round(Number(score) * 100)}%`;

export function OfferComparisonTable({
  decision,
}: {
  decision: NonNullable<Decision>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Supplier</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Due before shipment</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {decision.decisionRecord.offers.map((offer) => {
            const winner = offer.offerId === decision.winnerOfferId;
            return (
              <TableRow
                key={offer.offerId}
                data-state={winner ? "selected" : undefined}
              >
                <TableCell className="font-medium">
                  {supplierName(offer.candidate.supplierId)}
                </TableCell>
                <TableCell className="font-mono">
                  {formatMoney(offer.totalMinor, offer.candidate.currency)}
                </TableCell>
                <TableCell>{offer.quality}/5</TableCell>
                <TableCell>{offer.leadTimeDays} days</TableCell>
                <TableCell>{offer.preShipmentBps / 100}%</TableCell>
                <TableCell>
                  {winner ? (
                    <Badge>Recommended</Badge>
                  ) : offer.eligible ? (
                    <span className="text-xs text-muted-foreground">
                      {scoreLabel(offer.score)}
                    </span>
                  ) : (
                    <Badge variant="outline">
                      {offer.exclusionReasons.map(exclusionLabel).join(", ") ||
                        "Excluded"}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
