import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  // Single-line headline, sentence-case.
  title: string;
  // 1-2 sentences of context. Optional but almost always wanted.
  body?: string;
  // Optional CTA — typically a Link styled with buttonClassName.
  action?: ReactNode;
  className?: string;
}

// Quiet editorial empty state. Used wherever a list is structurally there
// but happens to be zero today — profile feeds, film perspectives, response
// threads. Visually a soft cream-deep block bordered by the rule color so
// it reads as "intentional pause" instead of "broken page".
export function EmptyState({ title, body, action, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-start gap-3 border border-rule bg-cream-deep/40 px-6 py-10",
        className,
      )}
    >
      <p className="font-display text-display-sm text-ink">{title}</p>
      {body && (
        <p className="max-w-prose font-body text-reading text-ink-soft">{body}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
