"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { FollowButton } from "@/components/follows/follow-button";
import { isLens } from "@/lib/lenses";
import { cn } from "@/lib/cn";
import type { PeopleSearchResult } from "@/app/api/people-search/route";

interface PeopleSearchProps {
  isSignedIn: boolean;
  // Set of usernames the viewer already follows. We initialize each row's
  // FollowButton with the right state so the page renders correctly without
  // a per-row round-trip.
  followingUsernames: string[];
}

// Two-character minimum mirrors the server. Single-char queries would
// return a wall of results; better to teach the user to type a bit more.
const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; results: PeopleSearchResult[] }
  | { kind: "empty" }
  | { kind: "error"; message: string };

// Debounced type-ahead search for profiles. The input is sticky-positioned
// at the top of the page so results scroll under it on a long list. Each
// result row is its own focusable link; the FollowButton sits inside the
// row but stops click propagation so it doesn't navigate.
export function PeopleSearch({
  isSignedIn,
  followingUsernames,
}: PeopleSearchProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const followingSet = useRef(new Set(followingUsernames));

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setStatus({ kind: "idle" });
      return;
    }

    // Debounce + cancel-on-supersede so a fast typist doesn't see results
    // for the prefix they finished a moment ago.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus({ kind: "loading" });
      try {
        const res = await fetch(
          `/api/people-search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setStatus({
            kind: "error",
            message: body?.error ?? "Search failed — try again.",
          });
          return;
        }
        const body = (await res.json()) as {
          results: PeopleSearchResult[];
        };
        if (body.results.length === 0) {
          setStatus({ kind: "empty" });
        } else {
          setStatus({ kind: "results", results: body.results });
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setStatus({ kind: "error", message: "Couldn't reach the server." });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const trimmed = query.trim();

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 bg-cream/95 px-4 pb-4 pt-2 backdrop-blur supports-[backdrop-filter]:bg-cream/80 sm:-mx-6 sm:px-6">
        <label htmlFor="people-search-input" className="sr-only">
          Search people
        </label>
        <div className="relative">
          <Search
            size={18}
            strokeWidth={1.75}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            id="people-search-input"
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search username or display name…"
            maxLength={50}
            className={cn(
              "block w-full border border-rule bg-cream py-3 pl-10 pr-10 font-body text-reading text-ink placeholder:text-ink-muted",
              "focus:border-ink focus:outline-none focus:ring-0",
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted hover:bg-cream-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine"
            >
              <X size={16} strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </div>
        <p
          aria-live="polite"
          className="mt-2 min-h-[1.25rem] font-mono text-meta-sm uppercase text-ink-muted"
        >
          {status.kind === "loading" && "Searching…"}
          {status.kind === "results" &&
            `${status.results.length} ${status.results.length === 1 ? "result" : "results"}`}
          {status.kind === "empty" && `No one named "${trimmed}".`}
          {status.kind === "error" && (
            <span className="text-wine">{status.message}</span>
          )}
        </p>
      </div>

      <div className="mt-4">
        {status.kind === "idle" && trimmed.length === 0 && (
          <p className="py-8 text-center font-body text-reading-sm italic text-ink-muted">
            Start typing to find writers.
          </p>
        )}

        {status.kind === "idle" && trimmed.length > 0 && (
          <p className="py-8 text-center font-mono text-meta-sm uppercase text-ink-muted">
            Type at least {MIN_QUERY} characters.
          </p>
        )}

        {status.kind === "results" && (
          <ul className="divide-y divide-rule border-y border-rule">
            {status.results.map((profile) => (
              <li key={profile.id}>
                <ResultRow
                  profile={profile}
                  isSignedIn={isSignedIn}
                  initialFollowing={followingSet.current.has(profile.username)}
                />
              </li>
            ))}
          </ul>
        )}

        {status.kind === "empty" && (
          <p className="py-8 text-center font-body text-reading-sm italic text-ink-muted">
            No matches. Try a different spelling — or invite them yourself.
          </p>
        )}
      </div>
    </div>
  );
}

interface ResultRowProps {
  profile: PeopleSearchResult;
  isSignedIn: boolean;
  initialFollowing: boolean;
}

// One result row. The avatar + name link wraps a separate region from the
// follow button — Next's Link will swallow inner button clicks if the
// button isn't isolated, so we put them side-by-side with a flex layout
// instead of nesting.
function ResultRow({ profile, isSignedIn, initialFollowing }: ResultRowProps) {
  const signInHref = `/login?next=${encodeURIComponent(`/${profile.username}`)}`;
  const lenses = profile.signature_lenses.filter(isLens).slice(0, 3);

  return (
    <div className="flex items-start gap-4 py-5">
      <Link
        href={`/${profile.username}`}
        className="flex min-w-0 flex-1 items-start gap-4 hover:opacity-90"
      >
        <Avatar
          src={profile.avatar_url}
          size={48}
          fallback={profile.display_name || profile.username}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="truncate font-display text-reading text-ink">
              {profile.display_name || profile.username}
            </p>
            {profile.is_private && (
              <span className="border border-rule px-1.5 py-0.5 font-mono text-[0.65rem] uppercase text-ink-muted">
                Private
              </span>
            )}
          </div>
          <p className="truncate font-mono text-meta-sm uppercase text-ink-muted">
            @{profile.username}
          </p>
          {profile.bio && (
            <p className="mt-1 line-clamp-2 font-body text-reading-sm text-ink-soft">
              {profile.bio}
            </p>
          )}
          {lenses.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {lenses.map((lens) => (
                <li
                  key={lens}
                  className="border border-rule px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-muted"
                >
                  {lens}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>

      <div className="shrink-0">
        <FollowButton
          username={profile.username}
          initialFollowing={initialFollowing}
          isSignedIn={isSignedIn}
          signInHref={signInHref}
        />
      </div>
    </div>
  );
}
