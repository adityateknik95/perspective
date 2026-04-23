import "server-only";
import type {
  FilmDetail,
  FilmSummary,
  TmdbMovieDetail,
  TmdbSearchResponse,
} from "./types";

// Thin wrapper around TMDB's v4 REST API. All calls are server-side only —
// the bearer token must never reach the browser. We lean on Next.js's fetch
// cache for cross-request dedup; within a single request we also keep a tiny
// LRU so repeated lookups of the same film don't round-trip to TMDB twice.

const TMDB_BASE = "https://api.themoviedb.org/3";
const FILM_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 1 week — film data barely changes
const SEARCH_CACHE_TTL_SECONDS = 60 * 60; // 1 hour for searches

function getToken(): string {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "TMDB_ACCESS_TOKEN is not set. Get a v4 Read Access Token from https://www.themoviedb.org/settings/api and add it to .env.local.",
    );
  }
  return token;
}

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number> = {},
  revalidate: number = FILM_CACHE_TTL_SECONDS,
): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/json",
    },
    // Next's fetch cache — dedups across requests and respects revalidate.
    next: { revalidate },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `TMDB ${path} failed: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`,
    );
  }

  return (await res.json()) as T;
}

// Request-lifetime cache. Next's fetch cache dedups across requests; this
// handles the case where one render calls getFilm(x) three times.
const detailCache = new Map<number, FilmDetail>();

function parseYear(releaseDate: string | undefined | null): number | null {
  if (!releaseDate) return null;
  const y = Number(releaseDate.slice(0, 4));
  return Number.isFinite(y) && y > 1800 ? y : null;
}

function directorFrom(detail: TmdbMovieDetail): string | null {
  const crew = detail.credits?.crew ?? [];
  // A film can have co-directors. Join with " & " if multiple are listed.
  const directors = crew.filter((c) => c.job === "Director").map((c) => c.name);
  if (directors.length === 0) return null;
  return directors.join(" & ");
}

export async function searchFilms(query: string): Promise<FilmSummary[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const data = await tmdbFetch<TmdbSearchResponse>(
    "/search/movie",
    {
      query: trimmed,
      include_adult: "false",
      language: "en-US",
      page: 1,
    },
    SEARCH_CACHE_TTL_SECONDS,
  );

  // Search results don't include credits, so we can't return directors here
  // without N extra round-trips. Best-effort: leave director null in search
  // results — the film page resolves it when the user commits to a film.
  return data.results.slice(0, 10).map<FilmSummary>((r) => ({
    tmdbId: r.id,
    title: r.title,
    year: parseYear(r.release_date),
    director: null,
    posterPath: r.poster_path,
    originalLanguage: r.original_language,
  }));
}

export async function getFilm(tmdbId: number): Promise<FilmDetail> {
  const cached = detailCache.get(tmdbId);
  if (cached) return cached;

  const data = await tmdbFetch<TmdbMovieDetail>(
    `/movie/${tmdbId}`,
    { append_to_response: "credits", language: "en-US" },
    FILM_CACHE_TTL_SECONDS,
  );

  const detail: FilmDetail = {
    tmdbId: data.id,
    title: data.title,
    year: parseYear(data.release_date),
    director: directorFrom(data),
    posterPath: data.poster_path,
    backdropPath: data.backdrop_path,
    overview: data.overview ?? "",
    runtimeMinutes: data.runtime ?? null,
    originalLanguage: data.original_language,
  };

  detailCache.set(tmdbId, detail);
  return detail;
}
