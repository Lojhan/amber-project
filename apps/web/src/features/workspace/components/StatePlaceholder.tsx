import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function StatePlaceholder({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-5 py-6 text-center">
      <Icon className="mb-2 size-5 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
