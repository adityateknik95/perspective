import { cn } from "@/lib/cn";

interface FieldErrorProps {
  id?: string;
  message?: string;
  className?: string;
}

export function FieldError({ id, message, className }: FieldErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className={cn(
        "min-h-[1.25rem] pt-1 font-mono text-meta-sm uppercase text-wine",
        className,
      )}
    >
      {message ?? "\u00a0"}
    </p>
  );
}
