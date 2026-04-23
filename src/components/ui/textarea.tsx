import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

interface TextareaProps extends ComponentPropsWithoutRef<"textarea"> {
  invalid?: boolean;
}

// Same visual language as Input — underline-only, no ring, wine border when
// invalid.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        "block w-full resize-y border-0 border-b bg-transparent py-3 font-body text-reading text-ink placeholder:text-ink-muted focus:outline-none focus:ring-0",
        invalid
          ? "border-wine focus:border-wine"
          : "border-rule focus:border-ink",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
