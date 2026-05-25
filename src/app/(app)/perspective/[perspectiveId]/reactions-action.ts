"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setReactionSchema } from "@/lib/validation/social";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

// Set or clear the viewer's reaction on a perspective.
//
// Contract:
//   - reactionType === null  → DELETE the row (idempotent — no row, still ok)
//   - reactionType !== null  → UPSERT to that type
//
// Authors can react to their own perspectives (Q3 from the brief: yes). The
// notifications trigger has its own self-actor guard so this is safe.
//
// Rate limit: 30 reaction changes / minute / user. Generous enough that a
// curious reader cycling through the picker isn't annoyed, tight enough that
// a script can't pound the upsert path.
export async function setReactionAction(values: {
  perspectiveId: string;
  reactionType: string | null;
}): Promise<ActionResult<{ reactionType: string | null }>> {
  const parsed = setReactionSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid reaction.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to react." };
  }

  const limit = checkRateLimit(`reaction:${user.id}`, {
    max: 30,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return {
      ok: false,
      error: `Slow down — try again in ${Math.ceil(limit.resetIn / 1000)}s.`,
    };
  }

  // Make sure the perspective is reactable. RLS would hide drafts/private
  // rows from non-authors anyway, but the explicit check produces a clean
  // error message instead of a confusing FK / constraint failure.
  //
  // We also pull the author's username and the film's tmdb_id so we can
  // revalidate /<username> and /film/<tmdbId> after the write — the card
  // badge on those pages would otherwise stay stale until the next time
  // they happen to revalidate for some other reason.
  const { data: target, error: lookupError } = await supabase
    .from("perspectives")
    .select(
      "id, user_id, is_draft, is_private, author:profiles!inner(username), film:films!inner(tmdb_id)",
    )
    .eq("id", parsed.data.perspectiveId)
    .maybeSingle();

  if (lookupError) return { ok: false, error: lookupError.message };
  if (!target) return { ok: false, error: "Perspective not found." };

  const isAuthor = target.user_id === user.id;
  if ((target.is_draft || target.is_private) && !isAuthor) {
    return { ok: false, error: "You can't react to this perspective." };
  }

  // Supabase types joined rows as array-or-object depending on shape; we
  // used !inner so both come back as objects, but narrow defensively.
  const author = Array.isArray(target.author) ? target.author[0] : target.author;
  const film = Array.isArray(target.film) ? target.film[0] : target.film;

  if (parsed.data.reactionType === null) {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("perspective_id", parsed.data.perspectiveId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    // Upsert on (perspective_id, user_id) — the table's PK. If the row
    // exists we want the new reaction_type to overwrite the old one.
    const { error } = await supabase
      .from("reactions")
      .upsert(
        {
          perspective_id: parsed.data.perspectiveId,
          user_id: user.id,
          reaction_type: parsed.data.reactionType,
        },
        { onConflict: "perspective_id,user_id" },
      );
    if (error) return { ok: false, error: error.message };
  }

  // Bust the read view's cache so the count line picks up the change on
  // next navigation. The picker itself uses optimistic state for the
  // current viewer, so we don't need a router.refresh() round-trip.
  //
  // List views (profile + film page) also render the badge — revalidate
  // them too so counts don't stay stale until something else triggers a
  // rebuild. Path-not-tracked is harmless; the call no-ops.
  revalidatePath(`/perspective/${parsed.data.perspectiveId}`);
  if (author?.username) revalidatePath(`/${author.username}`);
  if (film?.tmdb_id) revalidatePath(`/film/${film.tmdb_id}`);

  return { ok: true, data: { reactionType: parsed.data.reactionType } };
}
