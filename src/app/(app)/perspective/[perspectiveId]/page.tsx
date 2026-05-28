import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { FilmPoster } from "@/components/film-poster";
import { Avatar } from "@/components/ui/avatar";
import { isLens } from "@/lib/lenses";
import { excerpt as makeExcerpt } from "@/lib/reading";
import { posterUrl } from "@/lib/tmdb/urls";
import { cn } from "@/lib/cn";
import { OwnerActions } from "./owner-actions";
import {
  getReactionSummary,
  getViewerReaction,
} from "@/lib/social/queries";
import {
  dominantReaction,
  REACTION_LABELS,
} from "@/lib/social/reactions";
import { REACTION_ICONS } from "@/lib/social/reaction-icons";
import { ReactionPicker } from "@/components/reactions/reaction-picker";
import { ResponsesSection } from "@/components/responses/responses-section";

// UUIDs are 36 chars with 4 hyphens. Cheap reject for random garbage in the
// URL — saves a DB round-trip and a misleading 404.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PageProps {
  params: { perspectiveId: string };
}

// Shared between metadata generation and the page itself. Looking up twice
// would double our DB traffic on every page view.
async function loadPerspective(id: string) {
  if (!UUID_REGEX.test(id)) return null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Select the whole shape we need for rendering + OG + neighbour lookup.
  const { data, error } = await supabase
    .from("perspectives")
    .select(
      "id, user_id, title, subtitle, body, body_plaintext, lens_tags, reading_time_minutes, is_draft, is_private, published_at, film:films!inner(id, tmdb_id, title, year, director, poster_path), author:profiles!inner(id, username, display_name, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("load-perspective error:", error);
    return null;
  }
  if (!data) return null;

  const film = Array.isArray(data.film) ? data.film[0] : data.film;
  const author = Array.isArray(data.author) ? data.author[0] : data.author;
  if (!film || !author) return null;

  const isOwner = user?.id === data.user_id;

  // Drafts are author-only. Private pieces are author-only. RLS should
  // already have filtered these out for non-owners, but re-check so we
  // return a clean 404 rather than a rendered shell with nulls.
  if (data.is_draft && !isOwner) return null;
  if (data.is_private && !isOwner) return null;

  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    subtitle: data.subtitle,
    body: data.body,
    bodyPlaintext: data.body_plaintext,
    lensTags: (data.lens_tags ?? []).filter(isLens),
    readingTimeMinutes: data.reading_time_minutes ?? 0,
    isDraft: data.is_draft,
    isPrivate: data.is_private,
    publishedAt: data.published_at,
    film,
    author,
    isOwner,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const p = await loadPerspective(params.perspectiveId);
  if (!p) return { title: "Perspective not found" };

  const description = makeExcerpt(p.bodyPlaintext ?? "", 28);
  const poster = posterUrl(p.film.poster_path, "w500");

  return {
    title: `${p.title} — ${p.author.display_name || p.author.username}`,
    description,
    openGraph: {
      type: "article",
      title: p.title,
      description,
      ...(poster ? { images: [{ url: poster, width: 500, height: 750 }] } : {}),
      authors: [p.author.display_name || p.author.username],
    },
    twitter: {
      card: "summary_large_image",
      title: p.title,
      description,
      ...(poster ? { images: [poster] } : {}),
    },
    // Drafts and private pieces: even if someone with the URL reaches them,
    // don't let them leak into search indexes.
    robots:
      p.isDraft || p.isPrivate
        ? { index: false, follow: false }
        : undefined,
  };
}

export default async function PerspectivePage({ params }: PageProps) {
  const p = await loadPerspective(params.perspectiveId);
  if (!p) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  // Reactions data + response count + previous perspective lookup run in
  // parallel — independent queries, all feed the rendered shell. The
  // response count feeds the social-strip below the byline so readers
  // see "23 RESPONSES · 47 MOVED" at the top instead of scrolling to the
  // bottom of the piece to find out it has any social signal at all.
  const [reactionSummary, viewerReaction, responseCountResult, olderResult] =
    await Promise.all([
      getReactionSummary(p.id, supabase),
      getViewerReaction(p.id, viewerId, supabase),
      supabase
        .from("responses")
        .select("*", { count: "exact", head: true })
        .eq("perspective_id", p.id)
        .eq("is_deleted", false),
      // Previous perspective by the same author — powers the "Next" footer.
      // Ordered by published_at desc, so "previous" means "older piece".
      supabase
        .from("perspectives")
        .select("id, title, film:films!inner(title)")
        .eq("user_id", p.userId)
        .eq("is_draft", false)
        .eq("is_private", false)
        .lt("published_at", p.publishedAt ?? new Date().toISOString())
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const responseCount = responseCountResult.count ?? 0;
  const older = olderResult.data;
  const olderFilm = older && (Array.isArray(older.film) ? older.film[0] : older.film);
  const dominant = dominantReaction(reactionSummary);
  const DominantIcon = dominant ? REACTION_ICONS[dominant] : null;

  // Drafts and private pieces don't take public reactions. Authors can still
  // self-react on their own private/published pieces — useful for testing
  // the picker, harmless otherwise. The picker is hidden on drafts entirely.
  const showReactionPicker = !p.isDraft && (!p.isPrivate || p.isOwner);
  const signInHref = `/login?next=${encodeURIComponent(`/perspective/${p.id}`)}`;

  return (
    <article className="mx-auto max-w-reading px-4 py-10 sm:px-6 sm:py-12">
      {/* Author byline */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/${p.author.username}`}
          className="flex min-w-0 items-center gap-3"
        >
          <Avatar
            src={p.author.avatar_url}
            size={32}
            fallback={p.author.display_name || p.author.username}
          />
          <div className="min-w-0">
            <p className="truncate font-body text-reading-sm text-ink">
              {p.author.display_name || p.author.username}
            </p>
            <p className="truncate font-mono text-meta-sm uppercase text-ink-muted">
              {p.publishedAt ? (
                <>
                  <time dateTime={p.publishedAt}>
                    {formatDate(p.publishedAt)}
                  </time>
                  <span aria-hidden> · </span>
                </>
              ) : null}
              <span>{p.readingTimeMinutes} min</span>
            </p>
          </div>
        </Link>

        {p.isOwner && (
          <div className="shrink-0">
            <OwnerActions
              perspectiveId={p.id}
              isDraft={p.isDraft}
              isPrivate={p.isPrivate}
            />
          </div>
        )}
      </div>

      {/* Social signal strip — anchors to the picker/thread below. We hide
          this entirely when nothing has happened yet (0 responses, 0
          reactions) so a fresh post doesn't carry empty scaffolding at
          the top. Counts use ink for the number + muted for the label so
          the eye lands on the count first. */}
      {(responseCount > 0 || reactionSummary.total > 0) && (
        <nav
          aria-label="Quick links to social signal"
          className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-meta-sm uppercase tracking-[0.15em] text-ink-muted"
        >
          {responseCount > 0 && (
            <a
              href="#responses"
              className="inline-flex items-baseline gap-1.5 underline-offset-4 transition-colors hover:text-ink"
            >
              <span className="text-ink">{responseCount}</span>
              <span>{responseCount === 1 ? "response" : "responses"}</span>
            </a>
          )}
          {responseCount > 0 && dominant && reactionSummary[dominant] > 0 && (
            <span aria-hidden>·</span>
          )}
          {dominant && reactionSummary[dominant] > 0 && (
            <a
              href="#reactions"
              className="inline-flex items-center gap-1.5 underline-offset-4 transition-colors hover:text-ink"
            >
              {DominantIcon && (
                <DominantIcon size={12} strokeWidth={1.75} aria-hidden />
              )}
              <span className="text-ink">
                {reactionSummary[dominant].toLocaleString()}
              </span>
              <span>{REACTION_LABELS[dominant].toLowerCase()}</span>
            </a>
          )}
        </nav>
      )}

      {/* Status strip — only for the author on a draft / private piece */}
      {p.isOwner && (p.isDraft || p.isPrivate) && (
        <div className="mt-6 border-l-2 border-wine bg-cream-deep/60 px-4 py-3 font-mono text-meta-sm uppercase text-ink">
          {p.isDraft ? "Draft" : "Private"}
          <span className="ml-2 normal-case tracking-normal font-body text-reading-sm text-ink-soft">
            {p.isDraft
              ? "\u2014 only you can see this."
              : "\u2014 only you can see this. Re-share without privacy to make it public."}
          </span>
        </div>
      )}

      {/* Title block */}
      <header className="mt-10">
        <h1 className="font-display text-display-md leading-[1.1] text-ink sm:text-display-lg md:text-display-xl md:leading-[1.05]">
          {p.title}
          <span className="italic">.</span>
        </h1>
        {p.subtitle && (
          <p className="mt-4 font-body text-reading italic text-ink-soft sm:text-reading-lg">
            {p.subtitle}
          </p>
        )}
      </header>

      {/* Film context card */}
      <Link
        href={`/film/${p.film.tmdb_id}`}
        className="mt-10 flex items-center gap-3 border border-rule bg-cream-deep/40 p-3 hover:border-ink-soft sm:gap-4 sm:p-4"
      >
        <FilmPoster
          posterPath={p.film.poster_path}
          title={p.film.title}
          width={56}
          height={84}
          size="w185"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-meta-sm uppercase text-ink-muted">
            On
          </p>
          <p className="mt-1 truncate font-display text-reading-lg text-ink sm:text-display-sm">
            {p.film.title}
          </p>
          <p className="mt-1 truncate font-mono text-meta-sm uppercase text-ink-muted">
            {p.film.year ?? "\u2014"}
            {p.film.director ? ` \u00b7 ${p.film.director}` : ""}
          </p>
        </div>
      </Link>

      {/* Body */}
      <div
        className={cn(
          "prose-like prose-like-read mt-12 max-w-none",
        )}
        dangerouslySetInnerHTML={{ __html: p.body }}
      />

      {/* Reactions */}
      {showReactionPicker && (
        <div id="reactions" className="mt-14 scroll-mt-16">
          <ReactionPicker
            perspectiveId={p.id}
            initialViewerReaction={viewerReaction}
            initialSummary={reactionSummary}
            isSignedIn={!!viewerId}
            signInHref={signInHref}
          />
        </div>
      )}

      {/* Responses — same gate as the reaction picker. Drafts and
          non-author views of private pieces hide the thread entirely.
          scroll-mt-16 keeps the section title visible below the sticky
          header when anchored to from the social strip. */}
      {showReactionPicker && (
        <div id="responses" className="scroll-mt-16">
          <ResponsesSection perspectiveId={p.id} />
        </div>
      )}

      {/* Lens tags */}
      {p.lensTags.length > 0 && (
        <section className="mt-14 border-t border-rule pt-8">
          <p className="font-mono text-meta-sm uppercase text-ink-muted">
            Filed under
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {p.lensTags.map((lens) => (
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

      {/* Next-perspective footer */}
      {older && olderFilm && (
        <nav
          aria-label="Next perspective"
          className="mt-16 border-t border-rule pt-10"
        >
          <p className="font-mono text-meta-sm uppercase text-ink-muted">
            Next from {p.author.display_name || p.author.username}
          </p>
          <Link
            href={`/perspective/${older.id}`}
            className="mt-3 block hover:text-wine"
          >
            <h3 className="font-display text-display-sm text-ink group-hover:text-wine">
              {older.title}
            </h3>
            <p className="mt-1 font-mono text-meta-sm uppercase text-ink-muted">
              On {olderFilm.title}
            </p>
          </Link>
        </nav>
      )}
    </article>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
