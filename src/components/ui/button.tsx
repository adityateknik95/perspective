import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ComponentPropsWithoutRef,
} from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-wine text-cream hover:bg-wine-deep disabled:bg-ink-muted disabled:text-cream/70",
  secondary:
    "bg-transparent text-ink border border-rule hover:border-ink-soft hover:bg-cream-deep",
  ghost: "bg-transparent text-ink hover:bg-cream-deep",
  link: "bg-transparent text-wine underline-offset-4 hover:underline h-auto px-0",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.75rem]",
  md: "h-10 px-5 text-[0.8125rem]",
  lg: "h-12 px-7 text-[0.875rem]",
};

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-none font-mono uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60";

// Exported so `ButtonLink` and next/link consumers can reuse the styling
// without nesting a <button> inside an <a>.
export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(baseStyles, variantStyles[variant], sizeStyles[size], className);
}

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, type, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={buttonClassName(variant, size, className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Anchor styled as a button. Use with next/link's `legacyBehavior={false}`
// (the default in 14) by just composing: <Link href={...} className={...}>…
// or wrap with <Link href asChild passHref> in older patterns. For our own
// code the simplest is: <Link href className={buttonClassName(...)}>.
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => (
    <a
      ref={ref}
      className={buttonClassName(variant, size, className)}
      {...props}
    />
  ),
);
ButtonLink.displayName = "ButtonLink";
