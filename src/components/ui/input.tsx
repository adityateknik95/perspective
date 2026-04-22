import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends ComponentPropsWithoutRef<"input"> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "block w-full border-0 border-b bg-transparent py-3 font-body text-reading text-ink placeholder:text-ink-muted focus:outline-none focus:ring-0",
        invalid
          ? "border-wine focus:border-wine"
          : "border-rule focus:border-ink",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
