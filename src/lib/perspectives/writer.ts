import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types";

// The only path that writes server-derived perspective columns.
//
// 0006_perspective_write_guards.sql revokes UPDATE on everything but
// is_private from the authenticated role, because the anon key is public and
// any signed-in user can call PostgREST directly. body / body_plaintext /
// word_count / reading_time_minutes / is_draft / published_at (and the
// title, subtitle and lens_tags that travel with them) are therefore written
// here, with the service-role client, AFTER the calling server action has:
//   1. authenticated the user,
//   2. checked ownership, and
//   3. sanitized the HTML in Node.
//
// This is a deliberate service-role use, not a missing policy being papered
// over: sanitization can't run in Postgres, so the trusted writer has to be
// the server. To keep the blast radius small, every write is pinned to
// (id, user_id) so a bug in a caller can never touch someone else's row, and
// a write that matched zero rows is reported as a failure rather than
// silently succeeding.

type PerspectiveUpdate = Database["public"]["Tables"]["perspectives"]["Update"];

export type PerspectiveContentPatch = Pick<
  PerspectiveUpdate,
  | "title"
  | "subtitle"
  | "body"
  | "body_plaintext"
  | "word_count"
  | "reading_time_minutes"
  | "lens_tags"
  | "is_private"
  | "is_draft"
  | "published_at"
>;

export type WriteResult = { ok: true } | { ok: false; error: string };

export async function writePerspective(
  id: string,
  ownerId: string,
  patch: PerspectiveContentPatch,
  opts: { onlyIfDraft?: boolean } = {},
): Promise<WriteResult> {
  const admin = createAdminClient();

  let query = admin
    .from("perspectives")
    .update(patch)
    .eq("id", id)
    .eq("user_id", ownerId);

  // Autosave passes onlyIfDraft so the "is it still a draft?" check and the
  // write are one statement. Without it, a save that was in flight while the
  // piece got published in another tab could overwrite the shared body.
  if (opts.onlyIfDraft) query = query.eq("is_draft", true);

  const { data, error } = await query.select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: opts.onlyIfDraft
        ? "This perspective is shared. Revert to draft to edit."
        : "Perspective not found.",
    };
  }
  return { ok: true };
}
