import { createClient } from "@/lib/supabase/server";
import { isLens } from "@/lib/lenses";
import { excerpt as makeExcerpt } from "@/lib/reading";
import {
  PerspectiveCard,
  type PerspectiveCardData,
} from "@/components/perspective-card";
import { EmptyState } from "@/components/ui/empty-state";
import { WriteFirst } from "@/components/empty/write-first";
import { getReactionSummariesFor } from "@/lib/social/queries";

interface FollowingTabProps {
  viewerId: string;
}

const PAGE_LIMIT = 20;

// Recent perspectives from people the viewer follows. Server-rendered —
// the page hits Supabase once for the follow set, once for the perspectives,
// once for the bulk reaction summary. No N+1.
export async function FollowingTab({ viewerId }: FollowingTabProps) {
  const supabase = createClient();

  // Who do we follow? Get just the ids — we'll join author profile data
  // in the next query via the foreign-key relationship.
  const { data: follows, error: followsErr } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewerId);

  if (followsErr) {
    console.error("FollowingTab follows lookup failed:", followsErr);
    return (
      <EmptyState
        title="Couldn't load your follows."
        body="Try refreshing in a moment. If it keeps happening, your session may have expired."
      />
    );
  }

  const followedIds = (follows ?? []).map((f) => f.following_id);

  // Empty-state path. New accounts won't have follows yet. Two ways in:
  // find writers to follow, or write the first piece yourself (which is
  // also how other people find *you*).
  if (followedIds.length === 0) {
    return (
      <EmptyState
        title="Your feed starts with a few writers."
        body="Follow people whose perspectives you want in your week, and their new pieces show up here."
        action={
          <WriteFirst
            seed={`following-empty-${viewerId}`}
            writeLabel="Write your first perspective"
            secondary={{ href: "/search", label: "Find writers" }}
          />
        }
      />
    );
  }

  const { data: rows, error: feedErr } = await supabase
    .from("perspectives")
    .select(
      "id, title, subtitle, body_plaintext, reading_time_minutes, lens_tags, published_at, user_id, profiles!inner(username, display_name, avatar_url), film:films!inner(tmdb_id, title, year, poster_path)",
    )
    .in("user_id", followedIds)
    .eq("is_draft", false)
    .eq("is_private", false)
    .is("hidden_at", null)
    .order("published_at", { ascending: false })
    .limit(PAGE_LIMIT);

  if (feedErr) {
    console.error("FollowingTab feed query failed:", feedErr);
    return (
      <EmptyState
        title="Couldn't load the feed."
        body="Try refreshing in a moment."
      />
    );
  }

  const feed = rows ?? [];

  if (feed.length === 0) {
    // The viewer follows people, but none of them have published yet.
    // Different copy from the no-follows path — the absence here is on
    // the writers, not the viewer.
    return (
      <EmptyState
        title="Quiet week from your follows."
        body="No one you follow has shared a perspective recently. The feed will fill in as they do."
        action={
          <WriteFirst
            seed={`following-quiet-${viewerId}`}
            secondary={{ href: "/search", label: "Find more writers" }}
          />
        }
      />
    );
  }

  // Batch reaction summaries for the visible feed in one round-trip.
  const summaries = await getReactionSummariesFor(
    feed.map((r) => r.id),
    supabase,
  );

  const cards: PerspectiveCardData[] = feed.map((row) => {
    // Supabase joined-relation narrowing: !inner gives us object shape at
    // runtime but the generated types still permit array.
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const film = Array.isArray(row.film) ? row.film[0] : row.film;
    return {
      id: row.id,
      title: row.title || "Untitled",
      subtitle: row.subtitle,
      excerpt: makeExcerpt(row.body_plaintext ?? "", 36),
      readingTimeMinutes: row.reading_time_minutes ?? 0,
      lensTags: (row.lens_tags ?? []).filter(isLens),
      publishedAt: row.published_at,
      author: {
        username: profile?.username ?? "",
        displayName: profile?.display_name ?? "",
        avatarUrl: profile?.avatar_url ?? null,
      },
      film: film
        ? {
            tmdbId: film.tmdb_id,
            title: film.title,
            year: film.year,
            posterPath: film.poster_path,
          }
        : undefined,
      reactionSummary: summaries.get(row.id),
    };
  });

  return (
    <div>
      <header className="mb-2">
        <p className="font-mono text-meta-sm uppercase tracking-[0.15em] text-ink-muted">
          From people you read
        </p>
        <h2 className="mt-2 font-display text-display-sm text-ink">
          Recent perspectives
        </h2>
      </header>
      <div>
        {cards.map((card) => (
          <PerspectiveCard key={card.id} perspective={card} showFilm />
        ))}
      </div>
    </div>
  );
}
