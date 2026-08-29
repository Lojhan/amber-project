import {
  CheckCircle2,
  FileCheck2,
  LoaderCircle,
  RotateCcw,
  ShoppingCart,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { WorkspaceActions } from "../actions";
import { formatMoney } from "../formatMoney";
import type { WorkspaceState } from "../types";
import { CommitmentPreview } from "./CommitmentPreview";
import { SectionCard } from "./SectionCard";
import { StepActions } from "./StepActions";

function IssuedPurchaseOrder({
  order,
  startAgain,
}: {
  order: NonNullable<WorkspaceState["purchaseOrder"]>;
  startAgain: WorkspaceActions["startAgain"];
}) {
  return (
    <>
      <Alert role="status">
        <CheckCircle2 aria-hidden="true" />
        <AlertTitle>Purchase order {order.number} issued</AlertTitle>
        <AlertDescription>
          {order.replayed === true
            ? "The existing idempotent result was returned; no duplicate order was created."
            : "The authoritative purchase order exists and this review is complete."}
        </AlertDescription>
      </Alert>
      <StepActions>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={startAgain}
        >
          <RotateCcw aria-hidden="true" />
          Start again
        </Button>
      </StepActions>
    </>
  );
}

function PreviewButton({
  state,
  preview,
}: {
  state: WorkspaceState;
  preview: WorkspaceActions["preview"];
}) {
  const previewing = state.pendingAction === "preview-order";

  return (
    <Button
      type="button"
      variant="outline"
      disabled={!state.decision?.winnerOfferId || previewing}
      onClick={() => void preview()}
    >
      {previewing ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <FileCheck2 aria-hidden="true" />
      )}
      {previewing ? "Preparing preview" : "Preview purchase order"}
    </Button>
  );
}

function ApprovalControls({
  state,
  actions,
}: {
  state: WorkspaceState;
  actions: Pick<WorkspaceActions, "preview" | "issue">;
}) {
  const preview = state.preview;
  const issuing = state.pendingAction === "issue-order";
  if (!preview)
    return <PreviewButton state={state} preview={actions.preview} />;

  return (
    <>
      <CommitmentPreview preview={preview} />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" className="w-full" disabled={issuing}>
            {issuing ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <ShoppingCart aria-hidden="true" />
            )}
            {issuing
              ? "Issuing purchase order"
              : "Approve and issue purchase order"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <ShoppingCart aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Issue this purchase order?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates an authoritative order for {preview.supplierId} worth{" "}
              {formatMoney(preview.totalMinor, preview.currency)} with{" "}
              {preview.lineCount} lines.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Return to review</AlertDialogCancel>
            <AlertDialogAction onClick={() => void actions.issue()}>
              Confirm and issue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PurchaseOrderCard({
  state,
  actions,
}: {
  state: WorkspaceState;
  actions: Pick<WorkspaceActions, "preview" | "issue" | "startAgain">;
}) {
  const issued = state.purchaseOrder;

  return (
    <SectionCard
      id="commitment"
      icon={ShoppingCart}
      title={issued ? "Purchase order issued" : "Approve the purchase order"}
      description={
        issued
          ? "The selected supplier and commercial terms are now committed."
          : "Preview the exact commitment, then explicitly approve its creation."
      }
      error={
        state.error?.action === "preview-order" ||
        state.error?.action === "issue-order"
          ? state.error
          : undefined
      }
    >
      <div className="space-y-4">
        {issued ? (
          <IssuedPurchaseOrder order={issued} startAgain={actions.startAgain} />
        ) : (
          <ApprovalControls state={state} actions={actions} />
        )}
      </div>
    </SectionCard>
  );
}
