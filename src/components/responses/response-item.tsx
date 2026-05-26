"use client";

import { useState, useTransition, useOptimistic } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ResponseComposer } from "./response-composer";
import {
  toggleResonanceAction,
  deleteResponseAction,
} from "@/app/(app)/perspective/[perspectiveId]/responses-actions";
import type { ResponseNode } from "@/lib/social/queries";
import { cn } from "@/lib/cn";

interface ResponseItemProps {
  response: ResponseNode;
  // Threading bits passed down from the section. ResponseList knows the
  // viewer; the item doesn't ask the supabase client again.
  perspectiveId: string;
  viewerId: string | null;
  signInHref: string;
  // Reply mode disables the "Reply" button so the tree stays one level
  // deep. Resonance still works on replies.
  isReply?: boolean;
}

// One row in the thread. Top-level rows can be replied to (toggles an
// inline composer) and may have nested children rendered underneath.
// Soft-deleted rows render as "[removed]" with the body and controls
// stripped, but their structural slot is preserved so replies line up.
//
// The viewer's resonance is tracked optimistically — clicking flips the
// pill before the server confirms; the action settles the count on next
// render. If the server rejects, the resonance count and active state
// roll back via the optimistic hook's automatic reset.
export function ResponseItem({
  response,
  perspectiveId,
  viewerId,
  signInHref,
  isReply,
}: ResponseItemProps) {
  const router = useRouter();
  const [showReply, setShowReply] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Optimistic resonance: (active, count). We pair them so the count
  // moves on click instead of waiting on the server.
  const initial = {
    active: response.viewer_resonated,
    count: response.resonance_count,
  };
  const [opt, applyOpt] = useOptimistic(
    initial,
    (state, nextActive: boolean) => ({
      active: nextActive,
      count: Math.max(0, state.count + (nextActive ? 1 : -1)),
    }),
  );

  const isOwn = !!viewerId && response.author.id === viewerId;
  const isDeleted = response.is_deleted;

  function onResonate() {
    if (!viewerId) {
      router.push(signInHref);
      return;
    }
    if (isDeleted) return;
    setError(null);
    const next = !opt.active;
    startTransition(async () => {
      applyOpt(next);
      const result = await toggleResonanceAction({ responseId: response.id });
      if (!result.ok) setError(result.error);
    });
  }

  function onDelete() {
    if (!isOwn || isDeleted) return;
    if (
      !confirm("Delete this response? It will show as [removed] in the thread.")
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteResponseAction({ responseId: response.id });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <article
      id={`response-${response.id}`}
      className="flex items-start gap-4 py-5"
    >
      <Avatar
        src={response.author.avatar_url}
        size={36}
        fallback={response.author.display_name || response.author.username}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {isDeleted ? (
            <span className="font-mono text-meta-sm uppercase text-ink-muted">
              Removed
            </span>
          ) : (
            <>
              <Link
                href={`/${response.author.username}`}
                className="font-display text-reading text-ink hover:underline"
              >
                {response.author.display_name || response.author.username}
              </Link>
              <Link
                href={`/${response.author.username}`}
                className="font-mono text-meta-sm uppercase text-ink-muted hover:text-ink"
              >
                @{response.author.username}
              </Link>
            </>
          )}
          <span
            aria-hidden
            className="font-mono text-meta-sm uppercase text-ink-muted"
          >
            ·
          </span>
          <time
            dateTime={response.created_at}
            className="font-mono text-meta-sm uppercase text-ink-muted"
          >
            {formatTimestamp(response.created_at)}
          </time>
        </div>

        <p
          className={cn(
            "mt-2 whitespace-pre-wrap font-body text-reading-sm",
            isDeleted ? "italic text-ink-muted" : "text-ink-soft",
          )}
        >
          {isDeleted ? "[removed]" : response.body_plaintext}
        </p>

        {!isDeleted && (
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={onResonate}
              disabled={isPending}
              aria-pressed={opt.active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-meta-sm uppercase transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                "disabled:cursor-not-allowed disabled:opacity-60",
                opt.active
                  ? "text-wine hover:bg-wine/10"
                  : "text-ink-muted hover:bg-cream-deep hover:text-ink",
              )}
            >
              <Heart
                size={14}
                strokeWidth={1.75}
                aria-hidden
                className={opt.active ? "fill-current" : ""}
              />
              {opt.count > 0 && <span>{opt.count}</span>}
              <span className="sr-only">
                {opt.active ? "Remove resonance" : "Resonate"}
              </span>
            </button>

            {!isReply && (
              <button
                type="button"
                onClick={() => {
                  if (!viewerId) {
                    router.push(signInHref);
                    return;
                  }
                  setShowReply((v) => !v);
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-meta-sm uppercase text-ink-muted transition-colors hover:bg-cream-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
              >
                <MessageCircle size={14} strokeWidth={1.75} aria-hidden />
                <span>Reply</span>
              </button>
            )}

            {isOwn && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isPending}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-meta-sm uppercase text-ink-muted transition-colors hover:bg-cream-deep hover:text-wine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-2 font-mono text-meta-sm uppercase text-wine"
          >
            {error}
          </p>
        )}

        {showReply && !isReply && (
          <div className="mt-4">
            <ResponseComposer
              perspectiveId={perspectiveId}
              parentResponseId={response.id}
              parentAuthor={response.author.username}
              autoFocus
              onDone={() => setShowReply(false)}
            />
          </div>
        )}

        {/* Nested replies render directly under the parent, indented by
            the avatar gutter. Replies-to-replies aren't allowed; the
            ResponseItem inside enforces this via isReply. */}
        {!isReply && response.replies.length > 0 && (
          <div className="mt-4 border-l border-rule pl-4">
            {response.replies.map((reply) => (
              <ResponseItem
                key={reply.id}
                response={reply}
                perspectiveId={perspectiveId}
                viewerId={viewerId}
                signInHref={signInHref}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

// Same shape as the inbox row timestamp — keep the wording identical.
function formatTimestamp(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
