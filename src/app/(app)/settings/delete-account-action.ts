"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import {
  confirmsUsername,
  deleteAccountSchema,
} from "@/lib/validation/profile";
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

const AVATAR_BUCKET = "avatars";
// Deletion is once per account; the limit only exists to slow down someone
// brute-forcing the confirmation on a hijacked session.
const RATE_DELETE = { max: 5, windowMs: 60 * 60_000 };

// Permanently delete the signed-in user's account.
//
// Deleting the auth user is the whole operation: profiles cascades from
// auth.users, and everything the user owns cascades from profiles
// (perspectives and their reactions/responses, follows, notifications,
// reports). 0011's trigger runs first and keeps other people's replies by
// detaching the user's threaded top-level responses instead of deleting them.
//
// Two things don't cascade and are handled here:
//   - Storage objects (avatars/<uid>/...) — removed before the user.
//   - The session cookie — cleared after, so the browser isn't left holding
//     a token for a user that no longer exists.
export async function deleteAccountAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = deleteAccountSchema.safeParse({
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please confirm.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to sign in again." };

  const limit = await checkRateLimit(`delete-account:${user.id}`, RATE_DELETE);
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, error: "Profile not found." };

  if (!confirmsUsername(parsed.data.confirmation, profile.username)) {
    return {
      ok: false,
      error: "That doesn't match your username.",
      fieldErrors: { confirmation: `Type ${profile.username} to confirm.` },
    };
  }

  const admin = createAdminClient();

  const { data: files } = await admin.storage
    .from(AVATAR_BUCKET)
    .list(user.id, { limit: 1000 });
  if (files && files.length > 0) {
    const { error: removeError } = await admin.storage
      .from(AVATAR_BUCKET)
      .remove(files.map((f) => `${user.id}/${f.name}`));
    // Not fatal: an orphaned avatar is a cleanup task, a half-deleted
    // account the user can't retry is worse.
    if (removeError) console.error("delete-account: avatar cleanup failed:", removeError);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("delete-account: deleteUser failed:", deleteError);
    return { ok: false, error: "Couldn't delete your account. Please try again." };
  }

  // The refresh token is already revoked server-side; this just clears the
  // cookies. It can error because the user no longer exists — that's fine.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});

  redirect("/?account=deleted");
}
