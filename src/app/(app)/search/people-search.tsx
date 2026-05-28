"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { ProfileRow } from "@/components/profile-row";
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
                <ProfileRow
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
