import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function BuyingPrioritiesField({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>Buying priorities</Label>
        <span className="font-mono text-xs text-muted-foreground">
          {value.length}/2000
        </span>
      </div>
      <Textarea
        id={id}
        maxLength={2000}
        rows={3}
        placeholder="Example: Delivery must be within 30 days. Prefer quality over the lowest price."
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <p className="text-xs leading-5 text-muted-foreground">
        Optional. AI will turn this note into priorities for you to review
        before any supplier negotiation starts.
      </p>
    </div>
  );
}
