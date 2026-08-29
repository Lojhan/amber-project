import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WorkspaceProblem } from "../types";
import { StepError } from "./StepError";

export function SectionCard({
  icon: Icon,
  title,
  description,
  action,
  children,
  id,
  error,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  error?: WorkspaceProblem | undefined;
}) {
  return (
    <Card id={id}>
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon aria-hidden="true" />
          </span>
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="mb-4">
            <StepError error={error} />
          </div>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}
