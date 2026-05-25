"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { followUsernameSchema } from "@/lib/validation/social";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

// Follow / unfollow by username. The action resolves username → profile id
// so callers stay clean of internal ids (URLs and UI never expose them).
//
// Rate limit: 60 follow ops / minute / user. Generous enough that a quick
// browse-and-follow burst on a discovery surface isn't punished; tight
// enough that a script can't pound either path.
//
// Self-follow is structurally impossible (the DB has a CHECK constraint on
// public.follows), but we reject it early to produce a clean error rather
// than a constraint-violation message.
async function resolveTarget(
  username: string,
): Promise<
  | { ok: true; viewerId: string; targetId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to follow." };
  }

  const { data: target, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!target) return { ok: false, error: "Profile not found." };

  if (target.id === user.id) {
    return { ok: false, error: "You can't follow yourself." };
  }

  return { ok: true, viewerId: user.id, targetId: target.id };
}

export async function followAction(values: {
  username: string;
}): Promise<ActionResult<{ following: true }>> {
  const parsed = followUsernameSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid username.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const resolved = await resolveTarget(parsed.data.username);
  if (!resolved.ok) return resolved;

  const limit = checkRateLimit(`follow:${resolved.viewerId}`, {
    max: 60,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return {
      ok: false,
      error: `Slow down — try again in ${Math.ceil(limit.resetIn / 1000)}s.`,
    };
  }

  const supabase = createClient();
  // Insert is idempotent at the app level — duplicates collide on the
  // composite PK. Treat the unique-violation as success.
  const { error } = await supabase.from("follows").insert({
    follower_id: resolved.viewerId,
    following_id: resolved.targetId,
  });

  if (error && !error.message.toLowerCase().includes("duplicate")) {
    return { ok: false, error: error.message };
  }

  // The profile page renders follower/following counts and the button
  // state — revalidate both ends of the edge.
  revalidatePath(`/${parsed.data.username}`);

  return { ok: true, data: { following: true } };
}

export async function unfollowAction(values: {
  username: string;
}): Promise<ActionResult<{ following: false }>> {
  const parsed = followUsernameSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid username.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const resolved = await resolveTarget(parsed.data.username);
  if (!resolved.ok) return resolved;

  const limit = checkRateLimit(`follow:${resolved.viewerId}`, {
    max: 60,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return {
      ok: false,
      error: `Slow down — try again in ${Math.ceil(limit.resetIn / 1000)}s.`,
    };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", resolved.viewerId)
    .eq("following_id", resolved.targetId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/${parsed.data.username}`);

  return { ok: true, data: { following: false } };
}
