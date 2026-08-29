import { AlertCircle, LoaderCircle, Upload } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { WorkspaceActions } from "../actions";
import type { WorkspaceState } from "../types";
import { BuyingPrioritiesField } from "./BuyingPrioritiesField";
import { QuotationFileDropzone } from "./QuotationFileDropzone";
import { SectionCard } from "./SectionCard";
import { StepActions } from "./StepActions";

const isXlsx = (file: File): boolean =>
  file.name.toLowerCase().endsWith(".xlsx");

export function UploadCard({
  state,
  upload,
}: {
  state: WorkspaceState;
  upload: WorkspaceActions["upload"];
}) {
  const fileId = useId();
  const noteId = useId();
  const [file, setFile] = useState<File>();
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState<string>();
  const pending = state.pendingAction === "upload";

  const selectFile = (selected: File | undefined) => {
    if (!selected) {
      setFile(undefined);
      setValidationError(undefined);
      return;
    }
    if (!isXlsx(selected)) {
      setFile(undefined);
      setValidationError("Only .xlsx quotation workbooks are supported.");
      return;
    }

    setFile(selected);
    setValidationError(undefined);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setValidationError(
        (current) => current ?? "Choose an XLSX quotation before uploading.",
      );
      return;
    }
    if (!isXlsx(file)) {
      setValidationError("Only .xlsx quotation workbooks are supported.");
      return;
    }

    setValidationError(undefined);
    void upload(file, note.trim() || undefined);
  };

  return (
    <SectionCard
      id="upload"
      icon={Upload}
      title="Upload quotation"
      description="Add the supplier workbook and any priorities the negotiation must respect."
      error={state.error?.action === "upload" ? state.error : undefined}
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <QuotationFileDropzone
          id={fileId}
          file={file}
          disabled={pending}
          onFile={selectFile}
        />
        <BuyingPrioritiesField
          id={noteId}
          value={note}
          disabled={pending}
          onChange={setNote}
        />
        {validationError ? (
          <Alert variant="destructive" role="alert">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        ) : null}
        <StepActions>
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload aria-hidden="true" />
            )}
            {pending ? "Reading quotation" : "Upload and continue"}
          </Button>
        </StepActions>
      </form>
    </SectionCard>
  );
}
