import { LoaderCircle, RotateCcw } from "lucide-react";
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
import type { WorkspaceState } from "../types";
import { StepError } from "./StepError";

export function ChallengeResetControl({
  state,
  reset,
}: {
  state: WorkspaceState;
  reset: WorkspaceActions["reset"];
}) {
  const resetting = state.pendingAction === "reset";
  const error = state.error?.action === "reset" ? state.error : undefined;

  return (
    <div className="grid gap-3">
      {error ? <StepError error={error} /> : null}
      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={resetting}
            >
              {resetting ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw aria-hidden="true" />
              )}
              {resetting ? "Resetting challenge" : "Reset challenge"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <RotateCcw aria-hidden="true" />
              </AlertDialogMedia>
              <AlertDialogTitle>Reset the entire challenge?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the uploaded workbooks, review
                decisions, negotiations, and issued purchase orders. The seeded
                catalog remains available so you can upload the same files
                again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep challenge data</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => void reset()}
              >
                Reset challenge
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
