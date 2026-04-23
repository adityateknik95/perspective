"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";
import { FilmPoster } from "@/components/film-poster";
import type { FilmSummary } from "@/lib/tmdb/types";

interface FilmSearchProps {
  // Parent decides what happens when the user commits to a film — usually
  // creating a draft and redirecting, or linking to the film page.
  onSelect: (film: FilmSummary) => void | Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  // When the parent is busy (e.g. creating a draft), we disable the combobox
  // so a double-click can't fire onSelect twice.
  busy?: boolean;
}

// Debounced TMDB search combobox. Keyboard nav: ArrowUp/Down to move,
// Enter to commit, Escape to close the menu.
export function FilmSearch({
  onSelect,
  placeholder = "Search for a film\u2026",
  autoFocus = false,
  className,
  busy = false,
}: FilmSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FilmSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  // Debounced fetch. Cancels in-flight requests on each keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setError(null);
      abortRef.current?.abort();
      return;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/film-search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { results: FilmSummary[] };
        setResults(data.results);
        setOpen(true);
        setHighlight(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Search failed \u2014 try again.");
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  // Outside-click to close.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const commit = useCallback(
    async (film: FilmSummary) => {
      setOpen(false);
      setQuery("");
      setResults([]);
      await onSelect(film);
    },
    [onSelect],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const film = results[highlight];
      if (film) void commit(film);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={busy}
        className="block w-full border-0 border-b border-rule bg-transparent py-4 font-body text-reading-lg text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none disabled:opacity-60"
      />

      {(loading || error) && (
        <p
          className={cn(
            "absolute right-0 top-4 font-mono text-meta-sm uppercase",
            error ? "text-wine" : "text-ink-muted",
          )}
        >
          {error ?? "Searching\u2026"}
        </p>
      )}

      {open && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[22rem] overflow-auto border border-rule bg-cream shadow-sm"
        >
          {results.map((film, i) => {
            const active = i === highlight;
            return (
              <li
                key={film.tmdbId}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  // Prevent the blur that would close the dropdown before
                  // the click lands.
                  e.preventDefault();
                  void commit(film);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors",
                  active ? "bg-cream-deep" : "hover:bg-cream-deep/60",
                )}
              >
                <FilmPoster
                  posterPath={film.posterPath}
                  title={film.title}
                  width={40}
                  height={60}
                  size="w92"
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-reading text-ink">
                    {film.title}
                  </p>
                  <p className="font-mono text-meta-sm uppercase text-ink-muted">
                    {film.year ?? "\u2014"}
                    {film.originalLanguage
                      ? ` \u00b7 ${film.originalLanguage.toUpperCase()}`
                      : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
