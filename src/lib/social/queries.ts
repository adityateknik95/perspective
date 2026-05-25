import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  EMPTY_REACTION_SUMMARY,
  isReactionType,
  type ReactionSummary,
  type ReactionType,
} from "@/lib/social/reactions";
import type { EnrichedNotification } from "@/lib/social/notifications";

// Server-only query helpers for the social layer. Each one wraps a
// PostgREST or RPC call and shapes the result into a stable TS type.
// Callers stay in app/ — components never touch the supabase client
// directly when one of these will do.

type Supa = ReturnType<typeof createClient>;

// -----------------------------------------------------------------------------
// Reactions
// -----------------------------------------------------------------------------

// Counts of each reaction on a perspective. Always returns a populated
// object — never undefined keys. Built on the get_perspective_reaction_summary
// RPC so the heavy lifting stays in Postgres.
export async function getReactionSummary(
  perspectiveId: string,
  supabase: Supa = createClient(),
): Promise<ReactionSummary> {
  const { data, error } = await supabase.rpc(
    "get_perspective_reaction_summary",
    { p_perspective_id: perspectiveId },
  );
  if (error) {
    console.error("getReactionSummary failed:", error);
    return { ...EMPTY_REACTION_SUMMARY };
  }
  // RPC always returns the full shape; defensive cast for narrowing.
  return data as ReactionSummary;
}

// What the current viewer has on this perspective. Returns null if they
// haven't reacted, or aren't signed in.
export async function getViewerReaction(
  perspectiveId: string,
  viewerId: string | null,
  supabase: Supa = createClient(),
): Promise<ReactionType | null> {
  if (!viewerId) return null;
  const { data, error } = await supabase
    .from("reactions")
    .select("reaction_type")
    .eq("perspective_id", perspectiveId)
    .eq("user_id", viewerId)
    .maybeSingle();
  if (error || !data) return null;
  return isReactionType(data.reaction_type) ? data.reaction_type : null;
}

// Bulk reaction summaries for a list of perspectives — used on feed / film
// pages to avoid N round-trips. Backed by the
// get_perspective_reaction_summaries(uuid[]) RPC so aggregation stays in
// Postgres; the previous row-scan + JS aggregation was fine at 20 rows but
// would scale linearly with reactions, not page size.
export async function getReactionSummariesFor(
  perspectiveIds: string[],
  supabase: Supa = createClient(),
): Promise<Map<string, ReactionSummary>> {
  const map = new Map<string, ReactionSummary>();
  if (perspectiveIds.length === 0) return map;

  const { data, error } = await supabase.rpc(
    "get_perspective_reaction_summaries",
    { p_ids: perspectiveIds },
  );
  if (error) {
    console.error("getReactionSummariesFor failed:", error);
    // Fall back to empty summaries — callers treat missing keys as zero,
    // so the worst case is a temporarily badge-less feed, not a crash.
    for (const id of perspectiveIds) {
      map.set(id, { ...EMPTY_REACTION_SUMMARY });
    }
    return map;
  }

  for (const row of data ?? []) {
    const { perspective_id, ...summary } = row;
    map.set(perspective_id, summary);
  }
  // Defensive: if the RPC omitted any id (shouldn't, but supabase types
  // don't enforce it), zero-fill so Map.get returns a populated shape.
  for (const id of perspectiveIds) {
    if (!map.has(id)) map.set(id, { ...EMPTY_REACTION_SUMMARY });
  }
  return map;
}

// -----------------------------------------------------------------------------
// Responses
// -----------------------------------------------------------------------------

export type ResponseNode = {
  id: string;
  perspective_id: string;
  parent_response_id: string | null;
  body: string;
  body_plaintext: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  resonance_count: number;
  viewer_resonated: boolean;
  replies: ResponseNode[];
};

// Fetch all responses on a perspective and assemble the two-level tree.
// Returns top-level responses with `replies` attached. Soft-deleted rows
// are kept in the tree so the structure renders intact — UI substitutes
// "[removed]" for the body.
export async function getResponseThread(
  perspectiveId: string,
  viewerId: string | null,
  supabase: Supa = createClient(),
): Promise<ResponseNode[]> {
  const { data: rows, error } = await supabase
    .from("responses")
    .select(
      "id, perspective_id, user_id, parent_response_id, body, body_plaintext, is_deleted, created_at, updated_at, author:profiles!inner(id, username, display_name, avatar_url)",
    )
    .eq("perspective_id", perspectiveId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getResponseThread failed:", error);
    return [];
  }

  const ids = (rows ?? []).map((r) => r.id);
  const [resCounts, viewerResonates] = await Promise.all([
    countResonances(ids, supabase),
    viewerId ? viewerResonancesFor(ids, viewerId, supabase) : Promise.resolve(new Set<string>()),
  ]);

  const nodes = new Map<string, ResponseNode>();
  for (const r of rows ?? []) {
    const author = Array.isArray(r.author) ? r.author[0] : r.author;
    nodes.set(r.id, {
      id: r.id,
      perspective_id: r.perspective_id,
      parent_response_id: r.parent_response_id,
      body: r.body,
      body_plaintext: r.body_plaintext,
      is_deleted: r.is_deleted,
      created_at: r.created_at,
      updated_at: r.updated_at,
      author: {
        id: author?.id ?? "",
        username: author?.username ?? "",
        display_name: author?.display_name ?? "",
        avatar_url: author?.avatar_url ?? null,
      },
      resonance_count: resCounts.get(r.id) ?? 0,
      viewer_resonated: viewerResonates.has(r.id),
      replies: [],
    });
  }

  const roots: ResponseNode[] = [];
  nodes.forEach((node) => {
    if (node.parent_response_id) {
      const parent = nodes.get(node.parent_response_id);
      if (parent) parent.replies.push(node);
      else roots.push(node); // orphan — render at top level rather than drop
    } else {
      roots.push(node);
    }
  });
  return roots;
}

async function countResonances(
  responseIds: string[],
  supabase: Supa,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (responseIds.length === 0) return map;

  const { data, error } = await supabase
    .from("response_resonances")
    .select("response_id")
    .in("response_id", responseIds);
  if (error) {
    console.error("countResonances failed:", error);
    return map;
  }
  for (const r of data ?? []) {
    map.set(r.response_id, (map.get(r.response_id) ?? 0) + 1);
  }
  return map;
}

async function viewerResonancesFor(
  responseIds: string[],
  viewerId: string,
  supabase: Supa,
): Promise<Set<string>> {
  const set = new Set<string>();
  if (responseIds.length === 0) return set;

  const { data, error } = await supabase
    .from("response_resonances")
    .select("response_id")
    .eq("user_id", viewerId)
    .in("response_id", responseIds);
  if (error) return set;
  for (const r of data ?? []) set.add(r.response_id);
  return set;
}

// -----------------------------------------------------------------------------
// Follows
// -----------------------------------------------------------------------------

export type FollowCounts = {
  followers: number;
  following: number;
};

export async function getFollowCounts(
  profileId: string,
  supabase: Supa = createClient(),
): Promise<FollowCounts> {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profileId),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profileId),
  ]);
  return {
    followers: followers ?? 0,
    following: following ?? 0,
  };
}

// True iff `viewerId` follows `profileId`.
export async function isFollowing(
  viewerId: string | null,
  profileId: string,
  supabase: Supa = createClient(),
): Promise<boolean> {
  if (!viewerId || viewerId === profileId) return false;
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", viewerId)
    .eq("following_id", profileId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

// -----------------------------------------------------------------------------
// Notifications
// -----------------------------------------------------------------------------

export async function getUnreadNotificationCount(
  userId: string,
  supabase: Supa = createClient(),
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

// Paginated notification fetch with the joins needed for sentence
// rendering. Returns EnrichedNotifications ready to pass to renderNotification.
export async function getNotifications(
  userId: string,
  opts: { limit?: number; before?: string } = {},
  supabase: Supa = createClient(),
): Promise<EnrichedNotification[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 15, 50));

  // Fetch notifications without joins. The notifications → profiles
  // relation has two FKs (user_id, actor_id), so a string projection with
  // PostgREST hint syntax confuses Supabase's TS inference enough to break
  // the row type. Two cheap follow-up queries are cleaner than fighting
  // generics and have predictable cost (page size ≤ 50).
  let query = supabase
    .from("notifications")
    .select(
      "id, type, actor_id, perspective_id, response_id, read_at, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts.before) {
    query = query.lt("created_at", opts.before);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("getNotifications failed:", error);
    return [];
  }
  if (!rows || rows.length === 0) return [];

  const actorIds = Array.from(new Set(rows.map((r) => r.actor_id)));
  const perspectiveIds = Array.from(
    new Set(rows.map((r) => r.perspective_id).filter((x): x is string => !!x)),
  );
  const responseIds = Array.from(
    new Set(rows.map((r) => r.response_id).filter((x): x is string => !!x)),
  );
  const reactionPairs = rows
    .filter((r) => r.type === "reaction" && r.perspective_id)
    .map((r) => ({
      perspectiveId: r.perspective_id as string,
      actorId: r.actor_id,
    }));

  const [actors, filmTitles, responseParents, reactionTypeLookup] =
    await Promise.all([
      fetchActorProfiles(actorIds, supabase),
      fetchFilmTitlesForPerspectives(perspectiveIds, supabase),
      fetchResponseParents(responseIds, supabase),
      fetchActorReactionTypes(reactionPairs, supabase),
    ]);

  return rows.map((r) => {
    const actor = actors.get(r.actor_id);
    const reaction_type =
      r.type === "reaction" && r.perspective_id
        ? reactionTypeLookup.get(`${r.perspective_id}::${r.actor_id}`)
        : undefined;
    const response_is_nested =
      r.type === "response" && r.response_id
        ? responseParents.get(r.response_id) ?? false
        : undefined;
    return {
      id: r.id,
      type: r.type,
      read_at: r.read_at,
      created_at: r.created_at,
      actor: {
        username: actor?.username ?? "",
        display_name: actor?.display_name ?? "",
        avatar_url: actor?.avatar_url ?? null,
      },
      perspective: r.perspective_id
        ? {
            id: r.perspective_id,
            film_title: filmTitles.get(r.perspective_id) ?? "a film",
          }
        : undefined,
      reaction_type,
      response_is_nested,
      response_id: r.response_id,
    };
  });
}

async function fetchActorProfiles(
  actorIds: string[],
  supabase: Supa,
): Promise<
  Map<
    string,
    { username: string; display_name: string; avatar_url: string | null }
  >
> {
  const map = new Map<
    string,
    { username: string; display_name: string; avatar_url: string | null }
  >();
  if (actorIds.length === 0) return map;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", actorIds);
  if (error) {
    console.error("fetchActorProfiles failed:", error);
    return map;
  }
  for (const p of data ?? []) {
    map.set(p.id, {
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
    });
  }
  return map;
}

async function fetchFilmTitlesForPerspectives(
  perspectiveIds: string[],
  supabase: Supa,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (perspectiveIds.length === 0) return map;
  const { data } = await supabase
    .from("perspectives")
    .select("id, film:films!inner(title)")
    .in("id", perspectiveIds);
  for (const r of data ?? []) {
    const film = Array.isArray(r.film) ? r.film[0] : r.film;
    if (film?.title) map.set(r.id, film.title);
  }
  return map;
}

async function fetchResponseParents(
  responseIds: string[],
  supabase: Supa,
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (responseIds.length === 0) return map;
  const { data } = await supabase
    .from("responses")
    .select("id, parent_response_id")
    .in("id", responseIds);
  for (const r of data ?? []) {
    map.set(r.id, r.parent_response_id !== null);
  }
  return map;
}

// Look up each (perspective, actor) pair's current reaction type. Returns
// a Map keyed by `${perspectiveId}::${actorId}` so the caller can resolve
// without re-iterating the input. We over-fetch slightly (the cartesian
// product of unique perspectives × unique actors) and filter client-side;
// for typical popover sizes (≤15 rows) the over-fetch is trivial.
async function fetchActorReactionTypes(
  pairs: Array<{ perspectiveId: string; actorId: string }>,
  supabase: Supa,
): Promise<Map<string, ReactionType>> {
  const map = new Map<string, ReactionType>();
  if (pairs.length === 0) return map;

  const perspectiveIds = Array.from(new Set(pairs.map((p) => p.perspectiveId)));
  const actorIds = Array.from(new Set(pairs.map((p) => p.actorId)));

  const { data, error } = await supabase
    .from("reactions")
    .select("perspective_id, user_id, reaction_type")
    .in("perspective_id", perspectiveIds)
    .in("user_id", actorIds);

  if (error) {
    console.error("fetchActorReactionTypes failed:", error);
    return map;
  }

  // Index everything we got back. Pairs that didn't match (the user
  // un-reacted between the notification firing and this query) just fall
  // out — renderNotification handles the missing reaction_type.
  for (const r of data ?? []) {
    if (isReactionType(r.reaction_type)) {
      map.set(`${r.perspective_id}::${r.user_id}`, r.reaction_type);
    }
  }
  return map;
}
