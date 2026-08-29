import type { ReactNode } from "react";

export function StepActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse items-stretch gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-end">
      {children}
    </div>
  );
}
