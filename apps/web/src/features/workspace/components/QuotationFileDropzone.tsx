import { FileSpreadsheet, Trash2 } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const fileSize = (bytes: number): string => {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
};

export function QuotationFileDropzone({
  id,
  file,
  disabled,
  onFile,
}: {
  id: string;
  file: File | undefined;
  disabled: boolean;
  onFile: (file: File | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const dropFile = (event: DragEvent<HTMLFieldSetElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) onFile(event.dataTransfer.files[0]);
  };

  const clearFile = () => {
    onFile(undefined);
    if (input.current) input.current.value = "";
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Supplier workbook</Label>
      <input
        ref={input}
        id={id}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        aria-label="XLSX quotation"
        aria-describedby={`${id}-hint`}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => onFile(event.currentTarget.files?.[0])}
      />
      <fieldset
        aria-label="Quotation file drop zone"
        className={cn(
          "flex min-h-36 w-full min-w-0 flex-col items-center justify-center rounded-xl border border-dashed px-4 py-7 text-center transition-colors sm:px-6",
          dragging
            ? "border-primary bg-primary/10"
            : "border-input bg-muted/15 hover:bg-muted/25",
          disabled && "pointer-events-none opacity-60",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={dropFile}
      >
        <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileSpreadsheet aria-hidden="true" />
        </span>
        <p className="text-sm font-medium">Drop an XLSX file here</p>
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
          Or choose the quotation workbook from your computer.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          Choose XLSX file
        </Button>
      </fieldset>
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/25 p-3">
          <FileSpreadsheet className="size-5 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground" role="status">
              {fileSize(file.size)} · ready to upload
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={`Remove ${file.name}`}
            onClick={clearFile}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
