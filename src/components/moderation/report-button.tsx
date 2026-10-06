"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import { REPORT_REASON_MAX } from "@/lib/validation/social";
import { reportAction } from "@/app/(app)/report-action";
import { cn } from "@/lib/cn";

interface ReportButtonProps {
  targetType: "perspective" | "response";
  targetId: string;
  isSignedIn: boolean;
  signInHref: string;
  className?: string;
}

// Quiet "Report" affordance that unfolds into a one-field form. Shown on
// perspectives and responses to signed-in readers who aren't the author.
export function ReportButton({
  targetType,
  targetId,
  isSignedIn,
  signInHref,
  className,
}: ReportButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<"closed" | "open" | "sent">("closed");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fieldId = `report-${targetType}-${targetId}`;

  if (state === "sent") {
    return (
      <p
        role="status"
        className={cn("font-mono text-meta-sm uppercase text-ink-muted", className)}
      >
        Reported — thank you. A moderator will take a look.
      </p>
    );
  }

  if (state === "closed") {
    return (
      <button
        type="button"
        onClick={() => (isSignedIn ? setState("open") : router.push(signInHref))}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-meta-sm uppercase text-ink-muted transition-colors hover:bg-cream-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
          className,
        )}
      >
        <Flag size={14} strokeWidth={1.75} aria-hidden />
        <span>Report</span>
      </button>
    );
  }

  return (
    <form
      className={cn("w-full space-y-3", className)}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await reportAction({ targetType, targetId, reason });
          if (result.ok) setState("sent");
          else setError(result.fieldErrors?.reason ?? result.error);
        });
      }}
    >
      <label htmlFor={fieldId} className="font-mono text-meta-sm uppercase text-ink-muted">
        What&apos;s wrong with this {targetType}?
      </label>
      <Textarea
        id={fieldId}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={REPORT_REASON_MAX}
        rows={3}
        aria-describedby={`${fieldId}-error`}
        autoFocus
      />
      <FieldError id={`${fieldId}-error`} message={error ?? undefined} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending || reason.trim().length === 0}>
          {isPending ? "Sending…" : "Send report"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setState("closed");
            setError(null);
          }}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
