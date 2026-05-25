import Link from "next/link";
import { FilmPoster } from "@/components/film-poster";
import { Avatar } from "@/components/ui/avatar";
import { ReactionSummaryBadge } from "@/components/reactions/reaction-summary";
import type { ReactionSummary } from "@/lib/social/reactions";
import { cn } from "@/lib/cn";

export interface PerspectiveCardData {
  id: string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  readingTimeMinutes: number;
  lensTags: string[];
  publishedAt: string | null;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  // Film is optional — when rendering inside a film page we already have
  // the poster up top and don't want to repeat it.
  film?: {
    tmdbId: number;
    title: string;
    year: number | null;
    posterPath: string | null;
  };
  // Optional — list views that have already batched the summary lookup
  // pass it in. Cards without one just don't render the badge.
  reactionSummary?: ReactionSummary;
}

interface PerspectiveCardProps {
  perspective: PerspectiveCardData;
  // Hides the film block on /film/[tmdbId], where the context is implicit.
  showFilm?: boolean;
  className?: string;
}

// A single row in the perspectives list. Used on film pages and profile pages.
// Keep it dumb and presentational — server components pass everything in.
export function PerspectiveCard({
  perspective,
  showFilm = true,
  className,
}: PerspectiveCardProps) {
  const {
    id,
    title,
    subtitle,
    excerpt,
    readingTimeMinutes,
    lensTags,
    publishedAt,
    author,
    film,
    reactionSummary,
  } = perspective;

  return (
    <article className={cn("border-b border-rule py-8 last:border-b-0", className)}>
      <div className="flex gap-6">
        {showFilm && film && (
          <Link
            href={`/film/${film.tmdbId}`}
            className="shrink-0"
            aria-label={`${film.title}${film.year ? ` (${film.year})` : ""}`}
          >
            <FilmPoster
              posterPath={film.posterPath}
              title={film.title}
              width={80}
              height={120}
              size="w185"
            />
          </Link>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-mono text-meta-sm uppercase text-ink-muted">
            <Avatar
              src={author.avatarUrl}
              size={20}
              fallback={author.displayName || author.username}
            />
            <Link
              href={`/${author.username}`}
              className="hover:text-ink hover:underline"
            >
              {author.displayName || author.username}
            </Link>
            <span aria-hidden>&middot;</span>
            <time dateTime={publishedAt ?? undefined}>
              {publishedAt ? formatDate(publishedAt) : "Draft"}
            </time>
            <span aria-hidden>&middot;</span>
            <span>{readingTimeMinutes} min</span>
            {reactionSummary && reactionSummary.total > 0 && (
              <>
                <span aria-hidden>&middot;</span>
                <ReactionSummaryBadge summary={reactionSummary} />
              </>
            )}
          </div>

          <h2 className="mt-3 font-display text-display-sm text-ink">
            <Link
              href={`/perspective/${id}`}
              className="hover:text-wine"
            >
              {title}
              <span className="italic">.</span>
            </Link>
          </h2>

          {subtitle && (
            <p className="mt-1 font-body text-reading-lg italic text-ink-soft">
              {subtitle}
            </p>
          )}

          {showFilm && film && (
            <p className="mt-2 font-mono text-meta-sm uppercase text-ink-muted">
              On{" "}
              <Link
                href={`/film/${film.tmdbId}`}
                className="text-ink hover:text-wine"
              >
                {film.title}
              </Link>
              {film.year ? ` (${film.year})` : ""}
            </p>
          )}

          {excerpt && (
            <p className="mt-4 max-w-prose font-body text-reading text-ink-soft">
              {excerpt}
            </p>
          )}

          {lensTags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {lensTags.map((lens) => (
                <li
                  key={lens}
                  className="border border-rule px-2 py-1 font-mono text-meta-sm uppercase text-ink-muted"
                >
                  {lens}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

// Short, reader-friendly date: "Apr 23, 2026".
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
