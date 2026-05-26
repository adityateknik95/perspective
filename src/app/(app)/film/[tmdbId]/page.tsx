import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateFilmByTmdbId } from "@/lib/films";
import { FilmPoster } from "@/components/film-poster";
import { PerspectiveCard, type PerspectiveCardData } from "@/components/perspective-card";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { yearInWords } from "@/lib/year-in-words";
import { excerpt as makeExcerpt } from "@/lib/reading";
import { isLens, LENSES, type Lens } from "@/lib/lenses";
import { getReactionSummariesFor } from "@/lib/social/queries";
import { cn } from "@/lib/cn";

interface PageProps {
  params: { tmdbId: string };
  searchParams: { lens?: string; cursor?: string };
}

const PAGE_SIZE = 10;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tmdbId = Number(params.tmdbId);
  if (!Number.isInteger(tmdbId)) return { title: "Film not found" };
  const entry = await getOrCreateFilmByTmdbId(tmdbId);
  if (!entry) return { title: "Film not found" };
  const year = entry.film.year ? ` (${entry.film.year})` : "";
  return {
    title: `${entry.film.title}${year}`,
    description: entry.film.overview ?? undefined,
  };
}

export default async function FilmPage({ params, searchParams }: PageProps) {
  const tmdbId = Number(params.tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) notFound();

  const entry = await getOrCreateFilmByTmdbId(tmdbId);
  if (!entry) notFound();

  const { film } = entry;
  const supabase = createClient();

  // Who's reading? We don't require auth, but we'll show "Write a perspective"
  // differently when signed out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Count totals, bucketed by lens — powers the tab strip AND the "N
  //    perspectives" fact in the header.
  const { data: allPublished } = await supabase
    .from("perspectives")
    .select("lens_tags")
    .eq("film_id", film.id)
    .eq("is_draft", false)
    .eq("is_private", false);

  const published = allPublished ?? [];
  const totalPerspectives = published.length;

  const lensCounts = new Map<Lens, number>();
  for (const row of published) {
    for (const tag of row.lens_tags ?? []) {
      if (isLens(tag)) {
        lensCounts.set(tag, (lensCounts.get(tag) ?? 0) + 1);
      }
    }
  }
  const activeLenses = LENSES.filter((l) => (lensCounts.get(l) ?? 0) > 0);

  // 2. The tab the viewer is on.
  const rawLens = searchParams.lens;
  const activeLens: Lens | null = rawLens && isLens(rawLens) ? rawLens : null;

  // 3. Paginated list. Cursor is the ISO timestamp of the last row on the
  //    previous page — we order by published_at desc and fetch rows strictly
  //    older than the cursor.
  let query = supabase
    .from("perspectives")
    .select(
      "id, title, subtitle, body_plaintext, reading_time_minutes, lens_tags, published_at, user_id, profiles!inner(username, display_name, avatar_url)",
    )
    .eq("film_id", film.id)
    .eq("is_draft", false)
    .eq("is_private", false)
    .order("published_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (activeLens) {
    query = query.contains("lens_tags", [activeLens]);
  }
  if (searchParams.cursor) {
    query = query.lt("published_at", searchParams.cursor);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error("film-page perspectives query failed:", error);
  }

  const fetched = rows ?? [];
  const hasMore = fetched.length > PAGE_SIZE;
  const pageRows = hasMore ? fetched.slice(0, PAGE_SIZE) : fetched;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.published_at : null;

  // Batch reaction summaries for the visible page in one round-trip.
  const reactionSummaries = await getReactionSummariesFor(
    pageRows.map((r) => r.id),
    supabase,
  );

  const cards: PerspectiveCardData[] = pageRows.map((row) => {
    // Supabase types the joined relation as an array or object depending on
    // the relationship shape. We selected profiles!inner, which gives us the
    // object shape at runtime — narrow it here.
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
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
      reactionSummary: reactionSummaries.get(row.id),
    };
  });

  const writeHref = user
    ? `/write/new?film=${film.tmdb_id}`
    : `/login?next=${encodeURIComponent(`/write/new?film=${film.tmdb_id}`)}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      {/* Header — poster on top on mobile, side-by-side on md+. */}
      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        <div className="shrink-0">
          <FilmPoster
            posterPath={film.poster_path}
            title={film.title}
            width={200}
            height={300}
            size="w500"
            withShadow
            priority
            className="mx-auto md:mx-0 md:!h-[480px] md:!w-[320px]"
          />
        </div>

        <div className="flex-1">
          <p className="font-mono text-meta-sm uppercase text-ink-muted">Film</p>
          <h1 className="mt-3 break-words font-display text-display-md leading-tight text-ink sm:text-display-lg">
            {film.title}
            <span className="italic">.</span>
          </h1>

          {film.year && (
            <p className="mt-2 font-body text-reading-lg italic text-ink-soft">
              {yearInWords(film.year)}
            </p>
          )}

          {film.director && (
            <p className="mt-6 font-mono text-meta-sm uppercase text-ink-muted">
              Directed by{" "}
              <span className="text-ink">{film.director}</span>
            </p>
          )}

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 font-mono text-meta-sm uppercase text-ink-muted">
            {film.runtime_minutes ? (
              <div>
                <dt className="sr-only">Runtime</dt>
                <dd>
                  <span className="text-ink">{film.runtime_minutes}</span> min
                </dd>
              </div>
            ) : null}
            {film.original_language && (
              <div>
                <dt className="sr-only">Language</dt>
                <dd>
                  <span className="text-ink">
                    {film.original_language.toUpperCase()}
                  </span>
                </dd>
              </div>
            )}
            <div>
              <dt className="sr-only">Perspectives</dt>
              <dd>
                <span className="text-ink">{totalPerspectives}</span>{" "}
                {totalPerspectives === 1 ? "perspective" : "perspectives"}
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={writeHref}
              className={buttonClassName("primary", "md")}
            >
              Write a perspective
            </Link>
            <button
              type="button"
              disabled
              title="Coming soon"
              className={cn(buttonClassName("secondary", "md"), "cursor-not-allowed")}
            >
              Add to library
            </button>
            <button
              type="button"
              disabled
              title="Coming soon"
              className={cn(buttonClassName("ghost", "md"), "cursor-not-allowed")}
            >
              Seen it
            </button>
          </div>

          {film.overview && (
            <p className="mt-8 max-w-prose font-body text-reading text-ink-soft">
              {film.overview}
            </p>
          )}
        </div>
      </div>

      {/* Perspectives list */}
      <section className="mt-16 border-t border-rule pt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-display-sm text-ink">
            Perspectives<span className="italic">.</span>
          </h2>
          <p className="font-mono text-meta-sm uppercase text-ink-muted">
            {totalPerspectives} total
          </p>
        </div>

        {activeLenses.length > 0 && (
          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Filter by lens">
            <LensTab
              tmdbId={film.tmdb_id}
              lens={null}
              label="All"
              count={totalPerspectives}
              active={activeLens === null}
            />
            {activeLenses.map((lens) => (
              <LensTab
                key={lens}
                tmdbId={film.tmdb_id}
                lens={lens}
                label={lens}
                count={lensCounts.get(lens) ?? 0}
                active={activeLens === lens}
              />
            ))}
          </nav>
        )}

        <div className="mt-6">
          {cards.length === 0 ? (
            <EmptyState
              title={
                activeLens
                  ? `Nothing through the ${activeLens} lens yet.`
                  : "No perspectives yet."
              }
              body={
                activeLens
                  ? `Try "All" to see how other writers have read ${film.title}.`
                  : `The first piece on ${film.title} sets the tone for everyone after.`
              }
              action={
                activeLens ? (
                  <Link
                    href={`/film/${film.tmdb_id}`}
                    className={buttonClassName("secondary", "sm")}
                  >
                    See all lenses
                  </Link>
                ) : (
                  <Link href={writeHref} className={buttonClassName("primary", "sm")}>
                    Write the first
                  </Link>
                )
              }
            />
          ) : (
            cards.map((c) => (
              <PerspectiveCard key={c.id} perspective={c} showFilm={false} />
            ))
          )}
        </div>

        {nextCursor && (
          <div className="mt-8 text-center">
            <Link
              href={{
                pathname: `/film/${film.tmdb_id}`,
                query: {
                  ...(activeLens ? { lens: activeLens } : {}),
                  cursor: nextCursor,
                },
              }}
              className={buttonClassName("secondary", "sm")}
            >
              Older perspectives
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function LensTab({
  tmdbId,
  lens,
  label,
  count,
  active,
}: {
  tmdbId: number;
  lens: Lens | null;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={{
        pathname: `/film/${tmdbId}`,
        query: lens ? { lens } : {},
      }}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 border px-3 py-1 font-mono text-meta-sm uppercase transition-colors",
        active
          ? "border-ink bg-ink text-cream"
          : "border-rule text-ink-muted hover:border-ink-soft hover:text-ink",
      )}
    >
      <span>{label}</span>
      <span className={cn("text-[0.65rem]", active ? "text-cream/70" : "text-ink-muted")}>
        {count}
      </span>
    </Link>
  );
}
