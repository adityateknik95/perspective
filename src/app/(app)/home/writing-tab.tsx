import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FilmPoster } from "@/components/film-poster";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClassName } from "@/components/ui/button";
import { pickPrompt } from "@/lib/prompts";

interface WritingTabProps {
  viewerId: string;
}

const DRAFT_LIMIT = 12;

// The "your desk" surface. Existing drafts surface here so a half-finished
// piece is one click away the next time you sit down. A daily-ish prompt
// rides above as a writing on-ramp for when you don't have an active draft.
export async function WritingTab({ viewerId }: WritingTabProps) {
  const supabase = createClient();

  // Drafts only — published / private-published pieces show up on the
  // profile. Order by updated_at so the most-recently-touched piece comes
  // first; that's almost always what you want to keep working on.
  const { data: drafts, error } = await supabase
    .from("perspectives")
    .select(
      "id, title, subtitle, body_plaintext, updated_at, lens_tags, film:films!inner(tmdb_id, title, year, poster_path)",
    )
    .eq("user_id", viewerId)
    .eq("is_draft", true)
    .order("updated_at", { ascending: false })
    .limit(DRAFT_LIMIT);

  if (error) {
    console.error("WritingTab drafts query failed:", error);
  }

  const list = drafts ?? [];

  // Stable per-day prompt. Seeded by the date so the prompt holds steady
  // for a session (and across reloads on the same day) but rotates as a
  // fresh nudge each morning.
  const today = new Date().toISOString().slice(0, 10);
  const prompt = pickPrompt(`${viewerId}-${today}`);

  return (
    <div className="space-y-12">
      {/* Prompt + new-draft hero. Sits above drafts so even a user with no
          drafts gets a clear starting point. */}
      <section className="border border-rule bg-cream-deep/40 p-6 sm:p-8">
        <p className="font-mono text-meta-sm uppercase tracking-[0.15em] text-ink-muted">
          Today&apos;s prompt
        </p>
        <p
          className="mt-3 font-display text-display-md leading-tight text-ink"
          // Prompts use markdown-ish *italics* — render the asterisks as
          // <em> for emphasis. The string set is curated and trusted
          // (constants in prompts.ts), so dangerouslySet is safe here.
          dangerouslySetInnerHTML={{
            __html: prompt
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/\*([^*]+)\*/g, "<em>$1</em>"),
          }}
        />
        <div className="mt-6">
          <Link
            href="/write/new"
            className={buttonClassName("primary", "md")}
          >
            Start a new perspective
          </Link>
        </div>
      </section>

      <section>
        <header className="mb-6">
          <p className="font-mono text-meta-sm uppercase tracking-[0.15em] text-ink-muted">
            In progress
          </p>
          <h2 className="mt-2 font-display text-display-sm text-ink">
            Your drafts<span className="italic">.</span>
          </h2>
        </header>

        {list.length === 0 ? (
          <EmptyState
            title="No drafts in progress."
            body="When you start writing about a film and don't finish it, it'll wait here for you."
          />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {list.map((row) => {
              const film = Array.isArray(row.film) ? row.film[0] : row.film;
              return (
                <li key={row.id}>
                  <Link
                    href={`/write/${row.id}`}
                    className="flex items-start gap-4 py-5 transition-colors hover:bg-cream-deep/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wine"
                  >
                    {film && (
                      <FilmPoster
                        posterPath={film.poster_path}
                        title={film.title}
                        width={56}
                        height={84}
                        size="w185"
                        className="shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-reading-lg text-ink">
                        {row.title || (
                          <span className="italic text-ink-muted">
                            Untitled draft
                          </span>
                        )}
                      </p>
                      {film && (
                        <p className="mt-1 font-mono text-meta-sm uppercase text-ink-muted">
                          On {film.title}
                          {film.year ? ` (${film.year})` : ""}
                        </p>
                      )}
                      <p className="mt-2 line-clamp-2 font-body text-reading-sm text-ink-soft">
                        {row.body_plaintext?.trim() ||
                          "Nothing written yet. Open to start."}
                      </p>
                      <p className="mt-2 font-mono text-meta-sm uppercase text-ink-muted">
                        Last edited {formatTimestamp(row.updated_at)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// Shorthand — same shape as the inbox row and response row timestamps.
function formatTimestamp(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

