import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export const Label = forwardRef<
  HTMLLabelElement,
  ComponentPropsWithoutRef<"label">
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "block font-mono text-meta-sm uppercase text-ink-soft",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";
