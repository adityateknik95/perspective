"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createResponseSchema } from "@/lib/validation/social";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

// Plain-text responses for v1. body and body_plaintext are stored as the
// same string — the DB keeps the columns separate so a future rich-text
// pass can sanitize body while keeping the plaintext fallback for search,
// excerpting, and notification copy without re-parsing HTML.
//
// Rate limits are tighter than reactions (you can hammer a reaction
// toggle but not type 20 thoughtful replies a minute). Resonances match
// the reaction cadence.
const RATE_WRITE  = { max: 10, windowMs: 60_000 };
const RATE_DELETE = { max: 20, windowMs: 60_000 };
const RATE_RESON  = { max: 60, windowMs: 60_000 };

const uuidSchema = z.string().uuid("Invalid id.");

const deleteResponseSchema = z.object({
  responseId: uuidSchema,
});

const toggleResonanceSchema = z.object({
  responseId: uuidSchema,
});

async function getViewer(): Promise<
  | { ok: true; viewerId: string }
  | { ok: false; error: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to respond." };
  return { ok: true, viewerId: user.id };
}

// Create a new response on a perspective. Top-level if parentResponseId is
// absent; otherwise a reply to that top-level response (one level only —
// a reply-to-a-reply is rejected here rather than at the DB layer).
//
// Notifications fire via DB trigger:
//   - top-level response → perspective author gets a "response" notification
//   - reply              → parent-response author gets a nested-response one
// The trigger self-suppresses if actor === recipient so writing on your own
// thread doesn't spam your own inbox.
export async function createResponseAction(values: {
  perspectiveId: string;
  parentResponseId?: string | null;
  body: string;
}): Promise<ActionResult<{ responseId: string }>> {
  const parsed = createResponseSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check your response.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const viewer = await getViewer();
  if (!viewer.ok) return viewer;

  const limit = checkRateLimit(`response:${viewer.viewerId}`, RATE_WRITE);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Slow down — try again in ${Math.ceil(limit.resetIn / 1000)}s.`,
    };
  }

  const supabase = createClient();

  // Check the perspective is reactable, same gate as reactions. The author
  // can respond on their own draft/private piece (useful for testing the
  // thread layout); everyone else needs it published-and-public.
  const { data: target, error: lookupError } = await supabase
    .from("perspectives")
    .select("id, user_id, is_draft, is_private")
    .eq("id", parsed.data.perspectiveId)
    .maybeSingle();
  if (lookupError) return { ok: false, error: lookupError.message };
  if (!target) return { ok: false, error: "Perspective not found." };

  const isAuthor = target.user_id === viewer.viewerId;
  if ((target.is_draft || target.is_private) && !isAuthor) {
    return { ok: false, error: "You can't respond to this perspective." };
  }

  // One-level nesting: if the caller passed a parent, look it up and make
  // sure it's a top-level response. Also verify it belongs to the same
  // perspective so a malicious caller can't graft replies onto unrelated
  // threads.
  if (parsed.data.parentResponseId) {
    const { data: parent, error: parentErr } = await supabase
      .from("responses")
      .select("id, perspective_id, parent_response_id")
      .eq("id", parsed.data.parentResponseId)
      .maybeSingle();
    if (parentErr) return { ok: false, error: parentErr.message };
    if (!parent) return { ok: false, error: "Parent response not found." };
    if (parent.perspective_id !== parsed.data.perspectiveId) {
      return { ok: false, error: "Parent belongs to a different perspective." };
    }
    if (parent.parent_response_id !== null) {
      return { ok: false, error: "Replies to replies aren't supported." };
    }
  }

  // body === body_plaintext for v1. Both columns are NOT NULL.
  const body = parsed.data.body.trim();

  const { data: inserted, error: insertErr } = await supabase
    .from("responses")
    .insert({
      perspective_id: parsed.data.perspectiveId,
      user_id: viewer.viewerId,
      parent_response_id: parsed.data.parentResponseId ?? null,
      body,
      body_plaintext: body,
    })
    .select("id")
    .single();

  if (insertErr) return { ok: false, error: insertErr.message };

  revalidatePath(`/perspective/${parsed.data.perspectiveId}`);

  return { ok: true, data: { responseId: inserted.id } };
}

// Soft-delete a response. Author-only (enforced at RLS too). We keep the
// row so the thread structure renders intact and substitute "[removed]"
// in the UI based on is_deleted. body is retained for moderation review.
export async function deleteResponseAction(values: {
  responseId: string;
}): Promise<ActionResult<{ responseId: string }>> {
  const parsed = deleteResponseSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid response id.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const viewer = await getViewer();
  if (!viewer.ok) return viewer;

  const limit = checkRateLimit(`response:${viewer.viewerId}`, RATE_DELETE);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Slow down — try again in ${Math.ceil(limit.resetIn / 1000)}s.`,
    };
  }

  const supabase = createClient();

  // Fetch perspective_id before the update so we can revalidate even on
  // the cascade-not-found edge case. RLS guarantees author-only access.
  const { data: existing, error: lookupErr } = await supabase
    .from("responses")
    .select("id, perspective_id, user_id, is_deleted")
    .eq("id", parsed.data.responseId)
    .maybeSingle();
  if (lookupErr) return { ok: false, error: lookupErr.message };
  if (!existing) return { ok: false, error: "Response not found." };
  if (existing.user_id !== viewer.viewerId) {
    return { ok: false, error: "You can't delete this response." };
  }
  if (existing.is_deleted) {
    // Idempotent — already gone is success.
    revalidatePath(`/perspective/${existing.perspective_id}`);
    return { ok: true, data: { responseId: existing.id } };
  }

  const { error: updateErr } = await supabase
    .from("responses")
    .update({ is_deleted: true })
    .eq("id", parsed.data.responseId)
    .eq("user_id", viewer.viewerId);
  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath(`/perspective/${existing.perspective_id}`);

  return { ok: true, data: { responseId: existing.id } };
}

// Toggle viewer's resonance on a response. Idempotent in both directions:
//   already resonated → DELETE the row
//   not resonated     → INSERT
// PK is (response_id, user_id) so concurrent inserts collapse to one.
//
// Returns the next state so the client can settle its optimistic update
// without a follow-up GET.
export async function toggleResonanceAction(values: {
  responseId: string;
}): Promise<ActionResult<{ resonated: boolean }>> {
  const parsed = toggleResonanceSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid response id.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const viewer = await getViewer();
  if (!viewer.ok) return viewer;

  const limit = checkRateLimit(`resonance:${viewer.viewerId}`, RATE_RESON);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Slow down — try again in ${Math.ceil(limit.resetIn / 1000)}s.`,
    };
  }

  const supabase = createClient();

  // Look up the response (also tells us the perspective_id for revalidation).
  const { data: response, error: lookupErr } = await supabase
    .from("responses")
    .select("id, perspective_id, is_deleted")
    .eq("id", parsed.data.responseId)
    .maybeSingle();
  if (lookupErr) return { ok: false, error: lookupErr.message };
  if (!response) return { ok: false, error: "Response not found." };
  if (response.is_deleted) {
    return { ok: false, error: "Can't resonate with a removed response." };
  }

  // Probe for an existing row. A round-trip beats relying on insert/conflict
  // error message text for branching.
  const { data: existing } = await supabase
    .from("response_resonances")
    .select("response_id")
    .eq("response_id", parsed.data.responseId)
    .eq("user_id", viewer.viewerId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("response_resonances")
      .delete()
      .eq("response_id", parsed.data.responseId)
      .eq("user_id", viewer.viewerId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/perspective/${response.perspective_id}`);
    return { ok: true, data: { resonated: false } };
  }

  const { error } = await supabase
    .from("response_resonances")
    .insert({
      response_id: parsed.data.responseId,
      user_id: viewer.viewerId,
    });
  // Duplicate-key collisions happen if a second tab beat us to it; treat
  // as success — the end state matches what the caller asked for.
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    return { ok: false, error: error.message };
  }
  revalidatePath(`/perspective/${response.perspective_id}`);
  return { ok: true, data: { resonated: true } };
}
