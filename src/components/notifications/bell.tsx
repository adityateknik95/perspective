import Link from "next/link";
import { Bell as BellIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUnreadNotificationCount } from "@/lib/social/queries";
import { cn } from "@/lib/cn";

// Header bell + unread count badge. Server-rendered per request — the
// count refreshes whenever the user navigates, which is the cadence the
// rest of the app uses (no polling, no realtime in v1).
//
// Rendered only for signed-in users; the AppHeader gates this.
export async function NotificationsBell() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const count = await getUnreadNotificationCount(user.id, supabase);
  const hasUnread = count > 0;
  // Counts above 99 stay legible as "99+" — the exact number isn't useful
  // past that point and a 3-digit pill blows out the header layout.
  const label = count > 99 ? "99+" : String(count);

  return (
    <Link
      href="/notifications"
      aria-label={
        hasUnread
          ? `Notifications — ${count} unread`
          : "Notifications"
      }
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors",
        "hover:bg-cream-deep hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
      )}
    >
      <BellIcon size={18} strokeWidth={1.75} aria-hidden />
      {hasUnread && (
        <span
          aria-hidden
          className={cn(
            "absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-wine px-1 text-[10px] font-medium leading-none text-cream",
            // Keep the pill round-ish even when label is "99+".
            label.length > 2 ? "h-[18px] px-1.5" : "h-[18px]",
          )}
        >
          {label}
        </span>
      )}
    </Link>
  );
}
