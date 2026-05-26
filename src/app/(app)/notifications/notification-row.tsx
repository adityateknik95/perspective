"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { markAsReadAction } from "./actions";
import { cn } from "@/lib/cn";
import type {
  EnrichedNotification,
  RenderedNotification,
} from "@/lib/social/notifications";

interface NotificationRowProps {
  notification: EnrichedNotification;
  rendered: RenderedNotification;
}

// One row in the inbox. The whole row is the click target — tapping fires
// the mark-as-read action (best-effort, we don't block on it) then routes
// to the rendered href. Already-read rows skip the action entirely.
//
// Visual state encodes read/unread:
//   unread → wine dot on the left, ink text
//   read   → no dot, muted text
//
// Sentence segments come from renderNotification — actor is bold, film is
// italic, plain is unstyled. Centralizing the wording in the lib means
// every surface (this page, the popover, future emails) reads identically.
export function NotificationRow({
  notification,
  rendered,
}: NotificationRowProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const isUnread = !notification.read_at;

  function onClick(e: React.MouseEvent) {
    // Allow modifier-clicks (cmd/ctrl/shift) to do their browser-native
    // thing — open in a new tab, etc. The mark-read still fires.
    if (isUnread) {
      startTransition(async () => {
        await markAsReadAction({ notificationId: notification.id });
      });
    }
    // Let the default <a> nav happen for plain clicks; we only intercept
    // to short-circuit the action for read rows.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    router.push(rendered.href);
  }

  return (
    <a
      href={rendered.href}
      onClick={onClick}
      className={cn(
        "group flex items-start gap-4 border-b border-rule px-4 py-5 transition-colors last:border-b-0",
        "hover:bg-cream-deep/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wine",
      )}
    >
      {/* Unread dot — fixed-width column even when absent so rows line up. */}
      <span
        aria-hidden
        className={cn(
          "mt-2 inline-block h-2 w-2 shrink-0 rounded-full",
          isUnread ? "bg-wine" : "bg-transparent",
        )}
      />

      <Avatar
        src={notification.actor.avatar_url}
        size={36}
        fallback={notification.actor.display_name || notification.actor.username}
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-body text-reading-sm",
            isUnread ? "text-ink" : "text-ink-muted",
          )}
        >
          {rendered.segments.map((seg, i) => {
            if (seg.kind === "actor")
              return (
                <strong key={i} className="font-medium text-ink">
                  {seg.text}
                </strong>
              );
            if (seg.kind === "film")
              return (
                <em key={i} className="italic">
                  {seg.text}
                </em>
              );
            return <span key={i}>{seg.text}</span>;
          })}
        </p>
        <p className="mt-1 font-mono text-meta-sm uppercase text-ink-muted">
          {formatTimestamp(notification.created_at)}
        </p>
      </div>
    </a>
  );
}

// Lightweight relative time. We don't pull in date-fns just for this —
// the inbox is the only surface that needs it. Anything older than a week
// falls back to the full date so people scanning a long history can place
// it without doing math.
function formatTimestamp(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) {
    const m = Math.floor(diff / minute);
    return `${m}m ago`;
  }
  if (diff < day) {
    const h = Math.floor(diff / hour);
    return `${h}h ago`;
  }
  if (diff < 7 * day) {
    const d = Math.floor(diff / day);
    return `${d}d ago`;
  }
  // Older than a week: "Nov 23".
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
