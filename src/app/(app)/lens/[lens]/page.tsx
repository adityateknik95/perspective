import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isLens, LENSES, type Lens } from "@/lib/lenses";
import {
  PerspectiveCard,
  type PerspectiveCardData,
} from "@/components/perspective-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClassName } from "@/components/ui/button";
import { excerpt as makeExcerpt } from "@/lib/reading";
import { getReactionSummariesFor } from "@/lib/social/queries";
import { cn } from "@/lib/cn";

interface PageProps {
  params: { lens: string };
  searchParams: { cursor?: string };
}

const PAGE_SIZE = 15;

// A short editorial gloss per lens — sets the tone of the page so it reads
// as a curated section, not a tag dump. Kept terse; the writing is the
// product, this is just the doorway.
const LENS_BLURB: Record<Lens, string> = {
  grief: "Films watched through loss — what they reopened, what they closed.",
  memory: "Pieces about what a film dredged up, accurate or not.",
  craft: "Attention to how the thing was made.",
  denial: "What the film — or the writer — refused to look at.",
  family: "The people you're from, on screen and off.",
  politics: "Films read as arguments about how we live together.",
  solitude: "Watched alone, about being alone.",
  childhood: "The version of you that watched first.",
  self: "Films that turned into mirrors.",
  faith: "Belief, doubt, and what the screen does with both.",
  work: "Labour, vocation, the day job — on film.",
  place: "Films inseparable from where they happen.",
  desire: "Wanting, on screen.",
  violence: "What the film did with force, and what it asked of you.",
  longing: "The ache for what isn't there.",
  time: "Films about its passing, or that play with it.",
  language: "Words, translation, what goes unsaid.",
  sound: "Score, silence, the thing you heard before you saw.",
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const lens = params.lens.toLowerCase();
  if (!isLens(lens)) return { title: "Lens not found" };
  return {
    title: `Filed under ${lens}`,
    description: LENS_BLURB[lens],
  };
}

type FeedRow = {
  id: string;
  title: string;
  subtitle: string | null;
  body_plaintext: string | null;
  reading_time_minutes: number | null;
  lens_tags: string[] | null;
  published_at: string | null;
  film:
    | { tmdb_id: number; title: string; year: number | null; poster_path: string | null }
    | { tmdb_id: number; title: string; year: number | null; poster_path: string | null }[]
    | null;
  profiles:
    | { username: string; display_name: string | null; avatar_url: string | null }
    | { username: string; display_name: string | null; avatar_url: string | null }[]
    | null;
};

// Everything filed under one lens, newest first. This is the page that makes
// the lens vocabulary navigable — a lens chip anywhere in the app links here.
// Cursor pagination on published_at, same shape as the film page.
export default async function LensPage({ params, searchParams }: PageProps) {
  const lens = params.lens.toLowerCase();
  if (!isLens(lens)) notFound();

  const supabase = createClient();

  let query = supabase
    .from("perspectives")
    .select(
      "id, title, subtitle, body_plaintext, reading_time_minutes, lens_tags, published_at, film:films!inner(tmdb_id, title, year, poster_path), profiles!inner(username, display_name, avatar_url)",
    )
    .contains("lens_tags", [lens])
    .eq("is_draft", false)
    .eq("is_private", false)
    .order("published_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (searchParams.cursor) {
    query = query.lt("published_at", searchParams.cursor);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("lens page query failed:", error);
  }

  const fetched = (rows ?? []) as FeedRow[];
  const hasMore = fetched.length > PAGE_SIZE;
  const pageRows = hasMore ? fetched.slice(0, PAGE_SIZE) : fetched;
  const nextCursor = hasMore
    ? pageRows[pageRows.length - 1]?.published_at
    : null;

  const summaries = await getReactionSummariesFor(
    pageRows.map((r) => r.id),
    supabase,
  );

  const cards: PerspectiveCardData[] = pageRows.map((row) => {
    const film = Array.isArray(row.film) ? row.film[0] : row.film;
    const profile = Array.isArray(row.profiles)
      ? row.profiles[0]
      : row.profiles;
    return {
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      excerpt: makeExcerpt(row.body_plaintext ?? "", 40),
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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-10">
        <p className="font-mono text-meta-sm uppercase tracking-[0.15em] text-ink-muted">
          Filed under
        </p>
        <h1 className="mt-3 font-display text-display-lg text-ink">
          {lens}
          <span className="italic">.</span>
        </h1>
        <p className="mt-3 max-w-prose font-body text-reading text-ink-soft">
          {LENS_BLURB[lens]}
        </p>
      </header>

      {/* Lens switcher — browse to an adjacent lens without going back. The
          current lens is highlighted; the rest are quiet links. */}
      <nav
        aria-label="Other lenses"
        className="mb-10 flex flex-wrap gap-2 border-y border-rule py-5"
      >
        {LENSES.map((l) => (
          <Link
            key={l}
            href={`/lens/${l}`}
            aria-current={l === lens ? "page" : undefined}
            className={cn(
              "border px-2.5 py-1 font-mono text-meta-sm uppercase tracking-[0.12em] transition-colors",
              l === lens
                ? "border-wine bg-wine text-cream"
                : "border-rule text-ink-muted hover:border-ink-soft hover:text-ink",
            )}
          >
            {l}
          </Link>
        ))}
      </nav>

      {cards.length === 0 ? (
        <EmptyState
          title="Nothing here yet."
          body={`No one has filed a perspective under ${lens} yet. The first one sets the tone.`}
          action={
            <Link href="/write/new" className={buttonClassName("primary", "sm")}>
              Write the first
            </Link>
          }
        />
      ) : (
        <div>
          {cards.map((card) => (
            <PerspectiveCard key={card.id} perspective={card} showFilm />
          ))}
        </div>
      )}

      {nextCursor && (
        <div className="mt-8 text-center">
          <Link
            href={{
              pathname: `/lens/${lens}`,
              query: { cursor: nextCursor },
            }}
            className={buttonClassName("secondary", "sm")}
          >
            Older perspectives
          </Link>
        </div>
      )}
    </div>
  );
}
