import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { USERNAME_REGEX } from "@/lib/validation/username";
import { isReservedUsername } from "@/lib/reserved-usernames";
import { Avatar } from "@/components/ui/avatar";
import { buttonClassName } from "@/components/ui/button";
import { isLens } from "@/lib/lenses";
import {
  PerspectiveCard,
  type PerspectiveCardData,
} from "@/components/perspective-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FollowButton } from "@/components/follows/follow-button";
import { excerpt as makeExcerpt } from "@/lib/reading";
import {
  getFollowCounts,
  getReactionSummariesFor,
  isFollowing,
} from "@/lib/social/queries";
import type { ReactionSummary } from "@/lib/social/reactions";

const FEED_LIMIT = 20;

interface PageProps {
  params: { username: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const username = params.username.toLowerCase();
  return { title: `@${username}` };
}

// The profile page is the union of three views:
//   owner     — it's you. Show drafts + private alongside the public feed.
//   public    — visible profile (either public, or you are the owner).
//   private   — exists but hidden. Instagram-style shell.
//   not-found — username is free. Route to /signup.
export default async function ProfilePage({ params }: PageProps) {
  const username = params.username.trim().toLowerCase();

  // Reject the shape early to dodge a DB call for junk paths. Reserved names
  // can never be registered, so they're guaranteed 404s for this route — the
  // Next.js route tree handles real ones (/login, /settings, etc.).
  if (!USERNAME_REGEX.test(username) || isReservedUsername(username)) {
    notFound();
  }

  const supabase = createClient();

  const [{ data: profile }, { data: userData }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, username, display_name, bio, avatar_url, signature_lenses, is_private",
      )
      .eq("username", username)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const viewer = userData.user;

  if (profile) {
    const isOwner = viewer?.id === profile.id;

    // Everything below is independent — fan out and gather.
    const [publicFeed, ownerOnly, followCounts, viewerFollows] =
      await Promise.all([
        fetchPublishedFeed(supabase, profile.id),
        isOwner
          ? fetchOwnerOnlyFeed(supabase, profile.id)
          : Promise.resolve([]),
        getFollowCounts(profile.id, supabase),
        // isFollowing short-circuits to false for owner/anon — cheap.
        viewer && !isOwner
          ? isFollowing(viewer.id, profile.id, supabase)
          : Promise.resolve(false),
      ]);

    // Batch-load reaction summaries for the public feed (drafts/private rows
    // can't have public reactions, so we skip them). One round-trip beats N.
    const publicIds = publicFeed.map((r) => r.id);
    const summaries = await getReactionSummariesFor(publicIds, supabase);

    const authorPayload = {
      username: profile.username,
      display_name: profile.display_name ?? "",
      avatar_url: profile.avatar_url,
    };

    return (
      <ProfileView
        username={profile.username}
        displayName={profile.display_name ?? ""}
        bio={profile.bio}
        avatarUrl={profile.avatar_url}
        lenses={(profile.signature_lenses ?? []).filter(isLens)}
        isPrivate={profile.is_private}
        isOwner={isOwner}
        isSignedIn={!!viewer}
        viewerFollows={viewerFollows}
        followerCount={followCounts.followers}
        followingCount={followCounts.following}
        published={publicFeed.map((row) =>
          toCardData(row, authorPayload, summaries.get(row.id)),
        )}
        ownerOnly={ownerOnly.map((row) => toCardData(row, authorPayload))}
      />
    );
  }

  // RLS hid the row. Could be private-not-owner, or truly unknown.
  const { data: isAvailable } = await supabase.rpc("username_available", {
    u: username,
  });

  if (isAvailable === false) {
    // Exists but private — Instagram shell.
    return <PrivateShell username={username} />;
  }

  notFound();
}

type FeedRow = {
  id: string;
  title: string;
  subtitle: string | null;
  body_plaintext: string | null;
  reading_time_minutes: number | null;
  lens_tags: string[] | null;
  published_at: string | null;
  updated_at: string;
  is_draft: boolean;
  is_private: boolean;
  film:
    | { tmdb_id: number; title: string; year: number | null; poster_path: string | null }
    | { tmdb_id: number; title: string; year: number | null; poster_path: string | null }[]
    | null;
};

async function fetchPublishedFeed(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<FeedRow[]> {
  const { data, error } = await supabase
    .from("perspectives")
    .select(
      "id, title, subtitle, body_plaintext, reading_time_minutes, lens_tags, published_at, updated_at, is_draft, is_private, film:films!inner(tmdb_id, title, year, poster_path)",
    )
    .eq("user_id", userId)
    .eq("is_draft", false)
    .eq("is_private", false)
    .order("published_at", { ascending: false })
    .limit(FEED_LIMIT);

  if (error) {
    console.error("profile public feed failed:", error);
    return [];
  }
  return (data ?? []) as FeedRow[];
}

async function fetchOwnerOnlyFeed(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<FeedRow[]> {
  // Drafts and private-but-published pieces. Ordered by updated_at so a
  // half-edited draft floats to the top, which is what the author wants
  // when they come back.
  const { data, error } = await supabase
    .from("perspectives")
    .select(
      "id, title, subtitle, body_plaintext, reading_time_minutes, lens_tags, published_at, updated_at, is_draft, is_private, film:films!inner(tmdb_id, title, year, poster_path)",
    )
    .eq("user_id", userId)
    .or("is_draft.eq.true,is_private.eq.true")
    .order("updated_at", { ascending: false })
    .limit(FEED_LIMIT);

  if (error) {
    console.error("profile owner-only feed failed:", error);
    return [];
  }
  return (data ?? []) as FeedRow[];
}

function toCardData(
  row: FeedRow,
  author: { username: string; display_name: string; avatar_url: string | null },
  reactionSummary?: ReactionSummary,
): PerspectiveCardData {
  const film = Array.isArray(row.film) ? row.film[0] : row.film;
  return {
    id: row.id,
    title: row.title || "Untitled",
    subtitle: row.subtitle,
    excerpt: makeExcerpt(row.body_plaintext ?? "", 32),
    readingTimeMinutes: row.reading_time_minutes ?? 0,
    lensTags: (row.lens_tags ?? []).filter(isLens),
    publishedAt: row.published_at,
    author: {
      username: author.username,
      displayName: author.display_name,
      avatarUrl: author.avatar_url,
    },
    film: film
      ? {
          tmdbId: film.tmdb_id,
          title: film.title,
          year: film.year,
          posterPath: film.poster_path,
        }
      : undefined,
    reactionSummary,
  };
}

function ProfileView({
  username,
  displayName,
  bio,
  avatarUrl,
  lenses,
  isPrivate,
  isOwner,
  isSignedIn,
  viewerFollows,
  followerCount,
  followingCount,
  published,
  ownerOnly,
}: {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  lenses: string[];
  isPrivate: boolean;
  isOwner: boolean;
  isSignedIn: boolean;
  viewerFollows: boolean;
  followerCount: number;
  followingCount: number;
  published: PerspectiveCardData[];
  ownerOnly: PerspectiveCardData[];
}) {
  const signInHref = `/login?next=${encodeURIComponent(`/${username}`)}`;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
        <Avatar
          src={avatarUrl}
          size={80}
          fallback={displayName || username}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-words font-display text-display-sm text-ink sm:text-display-md">
              {displayName || username}
              <span className="italic">.</span>
            </h1>
            {isPrivate && (
              <span className="border border-rule px-2 py-1 font-mono text-meta-sm uppercase text-ink-muted">
                Private
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-meta-sm uppercase text-ink-muted">
            @{username}
          </p>

          {/* Follower / following counts. Public for everyone — RLS allows
              select-all on follows, so we can render these to any viewer.
              Each chip is a Link to the corresponding list page; visually
              they match the lens-chip register elsewhere on the profile,
              so the eye groups them as the same kind of metadata. */}
          <dl className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/${username}/followers`}
              aria-label={`${followerCount} ${followerCount === 1 ? "follower" : "followers"}`}
              className="group inline-flex items-baseline gap-2 border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:bg-cream-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              <dd className="font-display text-reading-lg leading-none text-ink">
                {followerCount.toLocaleString()}
              </dd>
              <dt className="font-mono text-meta-sm uppercase tracking-[0.15em] text-ink-muted transition-colors group-hover:text-ink">
                {followerCount === 1 ? "follower" : "followers"}
              </dt>
            </Link>
            <Link
              href={`/${username}/following`}
              aria-label={`Following ${followingCount}`}
              className="group inline-flex items-baseline gap-2 border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:bg-cream-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              <dd className="font-display text-reading-lg leading-none text-ink">
                {followingCount.toLocaleString()}
              </dd>
              <dt className="font-mono text-meta-sm uppercase tracking-[0.15em] text-ink-muted transition-colors group-hover:text-ink">
                following
              </dt>
            </Link>
          </dl>

          {bio && (
            <p className="mt-5 max-w-prose font-body text-reading text-ink-soft">
              {bio}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {isOwner ? (
              <>
                <Link
                  href="/write/new"
                  className={buttonClassName("primary", "sm")}
                >
                  Write
                </Link>
                <Link
                  href="/settings"
                  className={buttonClassName("secondary", "sm")}
                >
                  Edit profile
                </Link>
              </>
            ) : (
              <FollowButton
                username={username}
                initialFollowing={viewerFollows}
                isSignedIn={isSignedIn}
                signInHref={signInHref}
              />
            )}
          </div>
        </div>
      </div>

      {lenses.length > 0 && (
        <section className="mt-12 border-t border-rule pt-10">
          <p className="font-mono text-meta-sm uppercase text-ink-muted">
            Signature lenses
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {lenses.map((lens) => (
              <li
                key={lens}
                className="border border-rule px-3 py-1 font-mono text-meta-sm uppercase text-ink"
              >
                {lens}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-14 border-t border-rule pt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-display-sm text-ink">
            Journals
          </h2>
          {published.length > 0 && (
            <p className="font-mono text-meta-sm uppercase text-ink-muted">
              {published.length} shared
            </p>
          )}
        </div>

        {published.length === 0 ? (
          <EmptyState
            className="mt-6"
            title={isOwner ? "Nothing here yet." : "No perspectives yet."}
            body={
              isOwner
                ? "Pick a film, write a perspective, hit share. Your writing lives here."
                : `Once @${username} shares something, it'll appear here.`
            }
            action={
              isOwner ? (
                <Link
                  href="/write/new"
                  className={buttonClassName("primary", "sm")}
                >
                  Write your first
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="mt-6">
            {published.map((card) => (
              <PerspectiveCard key={card.id} perspective={card} showFilm />
            ))}
          </div>
        )}
      </section>

      {isOwner && ownerOnly.length > 0 && (
        <section className="mt-14 border-t border-rule pt-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-display-sm text-ink">
              Only visible to you
            </h2>
            <p className="font-mono text-meta-sm uppercase text-ink-muted">
              Drafts &amp; private
            </p>
          </div>
          <p className="mt-2 max-w-prose font-body text-reading-sm text-ink-soft">
            Pieces in progress, plus anything you&apos;ve shared as private.
            Readers don&apos;t see this section.
          </p>
          <div className="mt-6">
            {ownerOnly.map((card) => (
              <OwnerOnlyCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Tiny wrapper around PerspectiveCard so draft/private rows get a status
// badge. We don't want to clutter the shared card component with states
// that only appear on one page.
function OwnerOnlyCard({ card }: { card: PerspectiveCardData }) {
  // The feed row has the is_draft/is_private flags; we smuggle them in via
  // publishedAt === null (draft) or via publishedAt set (private-published).
  const label = card.publishedAt ? "Private" : "Draft";

  return (
    <div className="relative">
      <span className="absolute -left-1 top-9 -translate-x-full border border-rule bg-cream px-2 py-1 font-mono text-meta-sm uppercase text-ink-muted">
        {label}
      </span>
      <PerspectiveCard perspective={card} showFilm />
    </div>
  );
}

function PrivateShell({ username }: { username: string }) {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <Avatar src={null} size={96} fallback={username} className="mx-auto" />
      <h1 className="mt-6 font-display text-display-md text-ink">
        @{username}
        <span className="italic">.</span>
      </h1>
      <p className="mt-2 font-mono text-meta-sm uppercase text-ink-muted">
        Private profile
      </p>
      <p className="mt-6 font-body text-reading text-ink-soft">
        Journals here are only visible to the writer.
      </p>
    </div>
  );
}
