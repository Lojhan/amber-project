import { ArrowLeft, LoaderCircle, ReceiptText, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspaceActions } from "../actions";
import { formatMoney } from "../formatMoney";
import type { WorkspaceState } from "../types";
import { StepError } from "./StepError";

const issuedDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const issuedDate = (value: string): string =>
  issuedDateFormatter.format(new Date(value));

const milestoneLabel = (milestone: string): string =>
  milestone.toLowerCase().replaceAll("_", " ");

function PurchaseOrderDetail({
  state,
  orderId,
  onBack,
}: {
  state: WorkspaceState;
  orderId: string;
  onBack: () => void;
}) {
  const order = state.purchaseOrderDetail;

  return (
    <div className="grid gap-4">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="justify-self-start"
        onClick={onBack}
      >
        <ArrowLeft aria-hidden="true" />
        Back to orders
      </Button>
      {!order || order.id !== orderId ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle className="animate-spin" aria-hidden="true" />
          Loading order details
        </div>
      ) : (
        <PurchaseOrderDetailContent order={order} />
      )}
    </div>
  );
}

function PurchaseOrderDetailContent({
  order,
}: {
  order: NonNullable<WorkspaceState["purchaseOrderDetail"]>;
}) {
  return (
    <div className="grid gap-4 rounded-lg border bg-muted/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{order.number}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Supplier {order.supplierId.slice(1)} · {order.leadTimeDays} day lead
            time
          </p>
        </div>
        <p className="font-mono font-medium">
          {formatMoney(order.totalMinor, order.currency)}
        </p>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Payment terms</dt>
          <dd className="mt-1 text-sm">
            {order.paymentSchedule
              .map(
                (installment) =>
                  `${installment.percentBasisPoints / 100}% ${milestoneLabel(installment.milestone)}`,
              )
              .join(" · ")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            Originating negotiation
          </dt>
          <dd className="mt-1 break-all font-mono text-xs">
            {order.negotiationId}
          </dd>
        </div>
      </dl>
      <div className="grid gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {order.lines.length} order lines
        </p>
        <ul className="grid divide-y rounded-lg border bg-background">
          {order.lines.map((line) => (
            <li key={line.sku} className="grid gap-2 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">{line.sku}</p>
                  {line.name ? (
                    <p className="text-xs text-muted-foreground">{line.name}</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-mono font-medium">
                  {formatMoney(line.extendedTotalMinor, order.currency)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {line.quantity} ×{" "}
                {formatMoney(line.unitPriceMinor, order.currency)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PurchaseOrderHistory({
  state,
  viewPurchaseOrder,
}: {
  state: WorkspaceState;
  viewPurchaseOrder: WorkspaceActions["viewPurchaseOrder"];
}) {
  const [open, setOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string>();
  const loading = state.pendingAction === "purchase-order-detail";
  const error =
    state.error?.action === "purchase-order-detail" ? state.error : undefined;

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close issued purchase orders"
          className="fixed inset-0 z-40 bg-background/70 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      {open ? (
        <aside
          id="purchase-order-history"
          aria-labelledby="purchase-order-history-title"
          className="fixed inset-y-3 left-3 z-50 flex w-[min(32rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl"
        >
          <header className="flex items-start justify-between gap-3 border-b px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <ReceiptText aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 id="purchase-order-history-title" className="font-semibold">
                  Issued purchase orders
                </h2>
                <p className="text-xs text-muted-foreground">
                  Durable commitments and their negotiation evidence
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Close issued purchase orders"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden="true" />
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {error ? (
              <div className="mb-4">
                <StepError error={error} />
              </div>
            ) : null}
            {detailOrderId ? (
              <PurchaseOrderDetail
                state={state}
                orderId={detailOrderId}
                onBack={() => setDetailOrderId(undefined)}
              />
            ) : state.purchaseOrders.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No purchase orders have been issued yet.
              </p>
            ) : (
              <div className="grid gap-4">
                <ul className="grid gap-2" aria-label="Purchase order list">
                  {state.purchaseOrders.map((order) => (
                    <li key={order.id}>
                      <button
                        type="button"
                        className="grid w-full gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/50"
                        disabled={loading}
                        onClick={() => {
                          setDetailOrderId(order.id);
                          void viewPurchaseOrder(order.id);
                        }}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block font-medium">
                              {order.number}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Supplier {order.supplierId.slice(1)} ·{" "}
                              {issuedDate(order.issuedAt)}
                            </span>
                          </span>
                          <Badge variant="outline">{order.status}</Badge>
                        </span>
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate font-mono text-[11px] text-muted-foreground">
                            {order.negotiationId}
                          </span>
                          <span className="shrink-0 font-mono font-medium">
                            {formatMoney(order.totalMinor, order.currency)}
                          </span>
                        </span>
                        {loading ? (
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <LoaderCircle
                              className="animate-spin"
                              aria-hidden="true"
                            />
                            Loading order details
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      ) : null}

      <Button
        type="button"
        size="lg"
        variant="outline"
        className="fixed bottom-5 left-5 z-30 gap-3 rounded-full bg-card px-5 shadow-xl"
        aria-expanded={open}
        aria-controls="purchase-order-history"
        onClick={() => {
          setDetailOrderId(undefined);
          setOpen(true);
        }}
      >
        <ReceiptText aria-hidden="true" />
        <span className="grid text-left leading-tight">
          <span>Issued orders</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            {state.purchaseOrders.length === 0
              ? "No orders yet"
              : `${state.purchaseOrders.length} ${state.purchaseOrders.length === 1 ? "order" : "orders"}`}
          </span>
        </span>
      </Button>
    </>
  );
}
