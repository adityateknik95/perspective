import Link from "next/link";
import {
  getNowPlaying,
  getTrendingThisWeek,
  getAnniversariesThisWeek,
} from "@/lib/tmdb/client";
import type { FilmSummary } from "@/lib/tmdb/types";
import { FilmPoster } from "@/components/film-poster";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClassName } from "@/components/ui/button";

// Server component — fetches the three TMDB lists in parallel and renders
// them as poster strips. TMDB calls are revalidated daily by the client
// helpers; if any one of them fails (rate limit, network, ISP filter, etc.)
// we render an empty state for that strip rather than crashing the page.
export async function FilmsTab() {
  // Promise.allSettled so one bad endpoint doesn't take the whole tab down.
  const [nowPlayingR, trendingR, anniversariesR] = await Promise.allSettled([
    getNowPlaying(),
    getTrendingThisWeek(),
    // Three nostalgic windows. 10/20/30 spans the common "I grew up on this"
    // / "this is a classic now" / "this is a foundational text" framing.
    getAnniversariesThisWeek([10, 20, 30]),
  ]);

  const nowPlaying = nowPlayingR.status === "fulfilled" ? nowPlayingR.value : [];
  const trending = trendingR.status === "fulfilled" ? trendingR.value : [];
  const anniversaries =
    anniversariesR.status === "fulfilled" ? anniversariesR.value : [];

  // If all three are empty we surface a single explanatory block instead
  // of three empty strips — most often this means TMDB is unreachable.
  const allEmpty =
    nowPlaying.length === 0 &&
    trending.length === 0 &&
    anniversaries.every((a) => a.films.length === 0);

  if (allEmpty) {
    return (
      <EmptyState
        title="Couldn't reach TMDB."
        body="Film discovery is offline right now. Existing films and perspectives still work — head to a film page directly, or write about something you already saw."
        action={
          <Link
            href="/write/new"
            className={buttonClassName("primary", "sm")}
          >
            Write a perspective
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-14">
      <FilmStrip
        kicker="In cinema"
        title="Now playing."
        body="Films currently in theatres. Write while it's still fresh."
        films={nowPlaying}
      />

      <FilmStrip
        kicker="Trending this week"
        title="What people are watching."
        body="Most-talked-about titles right now."
        films={trending}
      />

      {anniversaries.map((bucket) => {
        if (bucket.films.length === 0) return null;
        return (
          <FilmStrip
            key={bucket.yearsAgo}
            kicker={`${bucket.yearsAgo} years ago this week`}
            title={`${bucket.yearsAgo} years on.`}
            body={`Films released around this date in ${new Date().getFullYear() - bucket.yearsAgo}. Worth a rewatch — and a perspective.`}
            films={bucket.films}
          />
        );
      })}
    </div>
  );
}

// One horizontal strip of films. Posters are clickable into /film/[tmdbId]
// where the user can write a perspective or read existing ones. We keep
// posters small (104x156) so a row of 6 fits comfortably on desktop and
// a row scrolls horizontally on mobile.
function FilmStrip({
  kicker,
  title,
  body,
  films,
}: {
  kicker: string;
  title: string;
  body: string;
  films: FilmSummary[];
}) {
  if (films.length === 0) return null;

  return (
    <section>
      <header className="mb-5">
        <p className="font-mono text-meta-sm uppercase tracking-[0.15em] text-ink-muted">
          {kicker}
        </p>
        <h2 className="mt-2 font-display text-display-sm text-ink">
          {title.replace(/\.$/, "")}
        </h2>
        <p className="mt-1 max-w-prose font-body text-reading-sm text-ink-soft">
          {body}
        </p>
      </header>

      {/* Horizontal scroll on mobile, wrapping grid on sm+. Posters scaled
          so a typical desktop fits 6-8 across; mobile shows ~2.5 and swipes. */}
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:gap-4 sm:overflow-visible sm:px-0">
        {films.map((film) => (
          <li key={film.tmdbId} className="shrink-0">
            <Link
              href={`/film/${film.tmdbId}`}
              className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
              aria-label={`${film.title}${film.year ? ` (${film.year})` : ""}`}
            >
              <FilmPoster
                posterPath={film.posterPath}
                title={film.title}
                width={112}
                height={168}
                size="w185"
                className="transition-transform group-hover:-translate-y-0.5"
              />
              <div className="mt-2 w-28">
                <p className="truncate font-body text-reading-sm text-ink group-hover:text-wine">
                  {film.title}
                </p>
                {film.year && (
                  <p className="font-mono text-meta-sm uppercase text-ink-muted">
                    {film.year}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
