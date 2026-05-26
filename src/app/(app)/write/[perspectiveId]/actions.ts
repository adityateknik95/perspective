"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  publishSchema,
  saveDraftSchema,
  type PublishInput,
  type SaveDraftInput,
} from "@/lib/validation/perspective";
import { sanitizeBodyHtml, htmlToPlaintext } from "@/lib/sanitize-html";
import { wordCount, readingTimeMinutes } from "@/lib/reading";
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

// Every mutation here runs under the authenticated Supabase client. RLS is
// the last line of defence — but we still check ownership manually before
// querying so we can surface clean error messages instead of PGRST silence.

async function getOwnedPerspective(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "You need to sign in again." };
  }

  const { data, error } = await supabase
    .from("perspectives")
    .select("id, user_id, film_id, is_draft, published_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "Draft not found." };
  if (data.user_id !== user.id) {
    return { ok: false as const, error: "This isn't your draft." };
  }

  return { ok: true as const, supabase, user, perspective: data };
}

// Autosave. Runs on a debounce from the editor — once every ~1.5s while the
// user is actively typing. We silently reject writes to published rows;
// the UI should have flipped to read-only before the keystroke landed, but
// the race is worth guarding against.
export async function saveDraftAction(
  id: string,
  values: SaveDraftInput,
): Promise<ActionResult<{ savedAt: string }>> {
  const parsed = saveDraftSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const owner = await getOwnedPerspective(id);
  if (!owner.ok) return owner;

  if (!owner.perspective.is_draft) {
    return {
      ok: false,
      error: "This perspective is shared. Revert to draft to edit.",
    };
  }

  const bodyHtml = sanitizeBodyHtml(parsed.data.body ?? "");
  const bodyPlaintext = htmlToPlaintext(bodyHtml);
  const subtitleValue =
    parsed.data.subtitle && parsed.data.subtitle.trim().length > 0
      ? parsed.data.subtitle.trim()
      : null;

  const { error } = await owner.supabase
    .from("perspectives")
    .update({
      title: parsed.data.title ?? "",
      subtitle: subtitleValue,
      body: bodyHtml,
      body_plaintext: bodyPlaintext,
      word_count: wordCount(bodyPlaintext),
      reading_time_minutes: readingTimeMinutes(bodyPlaintext),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  return { ok: true, data: { savedAt: new Date().toISOString() } };
}

// Publish. Runs all the same writes as a save, plus sets is_draft=false,
// records published_at, and persists the lens tags and privacy choice.
// Final-gate validation lives here — the DB check constraint is a safety
// net, not the UX surface.
export async function publishAction(
  id: string,
  values: PublishInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = publishSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const owner = await getOwnedPerspective(id);
  if (!owner.ok) return owner;

  const bodyHtml = sanitizeBodyHtml(parsed.data.body ?? "");
  const bodyPlaintext = htmlToPlaintext(bodyHtml);

  if (bodyPlaintext.length === 0) {
    return { ok: false, error: "The body is empty." };
  }

  const subtitleValue =
    parsed.data.subtitle && parsed.data.subtitle.trim().length > 0
      ? parsed.data.subtitle.trim()
      : null;
  const lenses = Array.from(new Set(parsed.data.lens_tags));

  // Preserve the original published_at on republish so a perspective that
  // went Published → Edit → Re-publish keeps its identity on timelines.
  const nextPublishedAt =
    owner.perspective.published_at ?? new Date().toISOString();

  const { error } = await owner.supabase
    .from("perspectives")
    .update({
      title: parsed.data.title,
      subtitle: subtitleValue,
      body: bodyHtml,
      body_plaintext: bodyPlaintext,
      word_count: wordCount(bodyPlaintext),
      reading_time_minutes: readingTimeMinutes(bodyPlaintext),
      lens_tags: lenses,
      is_private: parsed.data.is_private,
      is_draft: false,
      published_at: nextPublishedAt,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  // Bust caches for pages that list this perspective. The profile page and
  // film page both render server-side from `perspectives`.
  revalidatePath("/");
  revalidatePath(`/perspective/${id}`);
  return { ok: true, data: { id } };
}

// Flip a published perspective back to draft. Called from the read view's
// "Edit" button. We preserve published_at so republishing is a no-op for
// timelines — it's the same entry, not a new one.
export async function revertToDraftAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const owner = await getOwnedPerspective(id);
  if (!owner.ok) return owner;

  if (owner.perspective.is_draft) {
    // Already a draft — idempotent.
    return { ok: true, data: { id } };
  }

  const { error } = await owner.supabase
    .from("perspectives")
    .update({ is_draft: true })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/perspective/${id}`);
  return { ok: true, data: { id } };
}

// Hard delete. Only available for drafts (to avoid surprising readers with
// a dead-link). Published pieces should be reverted-and-deleted if the
// author really means it.
export async function deletePerspectiveAction(id: string): Promise<never> {
  const owner = await getOwnedPerspective(id);
  if (!owner.ok) {
    redirect("/");
  }

  if (!owner.perspective.is_draft) {
    redirect(`/perspective/${id}`);
  }

  const { error } = await owner.supabase
    .from("perspectives")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("delete failed:", error);
    redirect(`/write/${id}`);
  }

  // Send them home. Their profile page is the natural next destination,
  // but we don't have the username handy without another round-trip.
  redirect("/");
}
