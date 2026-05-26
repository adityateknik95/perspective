"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

// Marking-as-read is recipient-only and idempotent. RLS already restricts
// the rows to the caller; we still validate the id shape early so a
// malformed input doesn't hit the DB.
const markOneSchema = z.object({
  notificationId: z.string().uuid("Invalid id."),
});

// One server action sets read_at on a single notification, the other on
// every unread notification for the viewer. Both revalidate /notifications
// (so the row's read state updates) and the layout cache key so the
// header bell drops its unread count.
//
// Rate limit is generous: someone mass-clicking through their inbox should
// never hit it. It exists to keep a buggy client from looping the call.
const RATE = { max: 120, windowMs: 60_000 };

async function getViewer(): Promise<
  | { ok: true; viewerId: string }
  | { ok: false; error: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to manage notifications." };
  return { ok: true, viewerId: user.id };
}

export async function markAsReadAction(values: {
  notificationId: string;
}): Promise<ActionResult<{ readAt: string }>> {
  const parsed = markOneSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid notification id.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const viewer = await getViewer();
  if (!viewer.ok) return viewer;

  const limit = checkRateLimit(`notif:${viewer.viewerId}`, RATE);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Slow down — try again in ${Math.ceil(limit.resetIn / 1000)}s.`,
    };
  }

  const supabase = createClient();
  const now = new Date().toISOString();

  // Only flip rows that are still unread — touching an already-read row is
  // a no-op but bumps updated_at on the table for no reason.
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("id", parsed.data.notificationId)
    .eq("user_id", viewer.viewerId)
    .is("read_at", null);

  if (error) return { ok: false, error: error.message };

  // The header bell renders unread count on /notifications, /[username],
  // and /perspective/[id]. Path-level revalidate would miss those; the
  // bell is server-rendered per request so a tag-based revalidate is
  // overkill — the count will refresh on the viewer's next navigation
  // anyway. We only revalidate /notifications so the row's read state
  // updates if they stay on the page.
  revalidatePath("/notifications");

  return { ok: true, data: { readAt: now } };
}

export async function markAllAsReadAction(): Promise<
  ActionResult<{ readAt: string; count: number }>
> {
  const viewer = await getViewer();
  if (!viewer.ok) return viewer;

  const limit = checkRateLimit(`notif:${viewer.viewerId}`, RATE);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Slow down — try again in ${Math.ceil(limit.resetIn / 1000)}s.`,
    };
  }

  const supabase = createClient();
  const now = new Date().toISOString();

  const { error, count } = await supabase
    .from("notifications")
    .update({ read_at: now }, { count: "exact" })
    .eq("user_id", viewer.viewerId)
    .is("read_at", null);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/notifications");

  return { ok: true, data: { readAt: now, count: count ?? 0 } };
}
