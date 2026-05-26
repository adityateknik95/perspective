import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  getNotifications,
  getUnreadNotificationCount,
} from "@/lib/social/queries";
import { renderNotification } from "@/lib/social/notifications";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClassName } from "@/components/ui/button";
import { MarkAllButton } from "./mark-all-button";
import { NotificationRow } from "./notification-row";

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: { before?: string };
}

export const metadata: Metadata = {
  title: "Notifications",
};

// The notifications inbox. Server-rendered list of EnrichedNotifications,
// rendered through the central sentence renderer so the wording matches
// everywhere this surface might appear (future: popover, email digests).
//
// Auth: signed-in only. RLS would return empty anyway, but redirecting to
// /login makes the experience for a signed-out tap-on-bell sane.
//
// Pagination: cursor on created_at — passes ?before=<iso> to the next
// page link. No prev link in v1 — the back button handles that and a
// linear inbox is easier to reason about than a numbered one.
export default async function NotificationsPage({ searchParams }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/notifications");

  // Fetch one extra row to detect "is there a next page?" cheaply.
  const [items, unreadCount] = await Promise.all([
    getNotifications(
      user.id,
      { limit: PAGE_SIZE + 1, before: searchParams.before },
      supabase,
    ),
    getUnreadNotificationCount(user.id, supabase),
  ]);

  const hasMore = items.length > PAGE_SIZE;
  const pageItems = hasMore ? items.slice(0, PAGE_SIZE) : items;
  const nextCursor = hasMore
    ? pageItems[pageItems.length - 1]?.created_at
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-meta-sm uppercase text-ink-muted">
            Inbox
          </p>
          <h1 className="mt-3 font-display text-display-sm text-ink sm:text-display-md">
            Notifications<span className="italic">.</span>
          </h1>
          {unreadCount > 0 && (
            <p className="mt-2 font-mono text-meta-sm uppercase text-ink-muted">
              {unreadCount} unread
            </p>
          )}
        </div>
        <MarkAllButton unreadCount={unreadCount} />
      </header>

      <section className="mt-10">
        {pageItems.length === 0 ? (
          <EmptyState
            title="Nothing here yet."
            body="When someone reacts to your perspective, responds to it, or follows you, it'll land here."
            action={
              <Link
                href="/write/new"
                className={buttonClassName("primary", "sm")}
              >
                Write a perspective
              </Link>
            }
          />
        ) : (
          <ul className="border-y border-rule">
            {pageItems.map((n) => (
              <li key={n.id}>
                <NotificationRow
                  notification={n}
                  rendered={renderNotification(n)}
                />
              </li>
            ))}
          </ul>
        )}

        {nextCursor && (
          <div className="mt-8 text-center">
            <Link
              href={{
                pathname: "/notifications",
                query: { before: nextCursor },
              }}
              className={buttonClassName("secondary", "sm")}
            >
              Older notifications
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
