"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createResponseAction } from "@/app/(app)/perspective/[perspectiveId]/responses-actions";
import { cn } from "@/lib/cn";

// Hard ceiling enforced by the DB CHECK constraint (1-2000 chars). We
// surface a soft warning as the user approaches it so they aren't surprised
// when the submit fails.
const MAX_LENGTH = 2000;
const WARN_AT = 1900;

interface ResponseComposerProps {
  perspectiveId: string;
  // Set for reply mode. The composer renders compact and the textarea
  // gets a "Reply to @username" placeholder hint.
  parentResponseId?: string;
  parentAuthor?: string;
  // Reply composers call this after a successful submit to dismiss
  // themselves. Top-level composers leave it undefined.
  onDone?: () => void;
  // Top-level composers autoFocus only when the user is signed in. Reply
  // composers always autoFocus — they appear in response to a click.
  autoFocus?: boolean;
}

// One composer, two modes — top-level (sits at the head of the thread)
// and reply (renders inline under a parent response). The mode is implicit
// from the presence of parentResponseId.
//
// Submit posts via createResponseAction, then router.refresh() so the new
// row appears via the server-rendered list — the composer doesn't keep
// its own optimistic copy. Cheaper than maintaining a parallel tree, and
// the read view is the source of truth.
export function ResponseComposer({
  perspectiveId,
  parentResponseId,
  parentAuthor,
  onDone,
  autoFocus,
}: ResponseComposerProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isReply = !!parentResponseId;
  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_LENGTH;
  const remaining = MAX_LENGTH - value.length;
  const showCount = value.length >= WARN_AT;

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const result = await createResponseAction({
        perspectiveId,
        parentResponseId: parentResponseId ?? null,
        body: trimmed,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setValue("");
      router.refresh();
      onDone?.();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "flex flex-col gap-3",
        isReply && "border-l-2 border-rule pl-4",
      )}
    >
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={isReply ? 2 : 3}
        maxLength={MAX_LENGTH}
        invalid={value.length > MAX_LENGTH}
        placeholder={
          isReply
            ? parentAuthor
              ? `Reply to @${parentAuthor}…`
              : "Reply…"
            : "Respond to this perspective…"
        }
        disabled={isPending}
        aria-label={isReply ? "Reply body" : "Response body"}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-meta-sm uppercase text-ink-muted">
          {showCount && (
            <span className={remaining < 0 ? "text-wine" : ""}>
              {remaining} left
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isReply && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setValue("");
                onDone?.();
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!canSubmit || isPending}
          >
            {isPending ? "Posting…" : isReply ? "Reply" : "Respond"}
          </Button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="font-mono text-meta-sm uppercase text-wine"
        >
          {error}
        </p>
      )}
    </form>
  );
}
