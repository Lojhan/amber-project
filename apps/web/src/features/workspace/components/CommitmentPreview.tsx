import type { PurchaseOrderPreview } from "../../../lib/api/contracts";
import { formatMoney } from "../formatMoney";

export function CommitmentPreview({
  preview,
}: {
  preview: PurchaseOrderPreview;
}) {
  return (
    <div className="rounded-lg border bg-primary/5 p-4">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">
        Commitment preview
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Supplier</dt>
          <dd className="mt-0.5 font-medium">{preview.supplierId}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="mt-0.5 font-mono font-medium">
            {formatMoney(preview.totalMinor, preview.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Order lines</dt>
          <dd className="mt-0.5">{preview.lineCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Lead time</dt>
          <dd className="mt-0.5">{preview.leadTimeDays} days</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted-foreground">Payment terms</dt>
          <dd className="mt-0.5 text-sm">
            {preview.paymentSchedule
              .map(
                (installment) =>
                  `${installment.percentBasisPoints / 100}% ${installment.milestone.toLowerCase().replaceAll("_", " ")}`,
              )
              .join(" · ")}
          </dd>
        </div>
      </dl>
    </div>
  );
}
