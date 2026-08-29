"use client";

import type { ChatStatus } from "ai";
import { CornerDownLeftIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import type {
  ComponentProps,
  FormEvent,
  HTMLAttributes,
  KeyboardEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type PromptInputProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit: (message: { text: string }) => void | Promise<void>;
};

export const PromptInput = ({
  className,
  children,
  onSubmit,
  ...props
}: PromptInputProps) => (
  <form
    className={cn(
      "rounded-xl border bg-background p-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
      className,
    )}
    onSubmit={async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const text = String(
        new FormData(event.currentTarget).get("message") ?? "",
      );
      if (!text.trim()) return;

      event.currentTarget.reset();
      await onSubmit({ text });
    }}
    {...props}
  >
    {children}
  </form>
);

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = (props: PromptInputBodyProps) => (
  <div {...props} />
);

export type PromptInputTextareaProps = ComponentProps<typeof Textarea>;

export const PromptInputTextarea = ({
  className,
  onKeyDown,
  ...props
}: PromptInputTextareaProps) => (
  <Textarea
    name="message"
    rows={3}
    className={cn(
      "min-h-20 resize-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-0",
      className,
    )}
    onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
      onKeyDown?.(event);
      if (
        !event.defaultPrevented &&
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
      }
    }}
    {...props}
  />
);

export type PromptInputFooterProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputFooter = ({
  className,
  ...props
}: PromptInputFooterProps) => (
  <div
    className={cn(
      "flex items-center justify-between gap-3 px-1 pt-2",
      className,
    )}
    {...props}
  />
);

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: ChatStatus;
};

export const PromptInputSubmit = ({
  status,
  children,
  ...props
}: PromptInputSubmitProps) => {
  const pending = status === "submitted" || status === "streaming";
  const icon = pending ? (
    <LoaderCircleIcon className="animate-spin" />
  ) : status === "error" ? (
    <XIcon />
  ) : (
    <CornerDownLeftIcon />
  );

  return (
    <Button
      type="submit"
      size="icon-sm"
      aria-label={pending ? "Waiting for copilot" : "Send message"}
      {...props}
    >
      {children ?? icon}
    </Button>
  );
};
