import "server-only";
import { cache } from "react";
import { getFilm } from "@/lib/tmdb/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Film } from "@/lib/types";

// Returns the local films row for a TMDB id, inserting it from TMDB on first
// encounter. The row is the SSR source of truth for the film page and the
// FK target for perspectives, so every /film/[tmdbId] render touches this.
//
// Cache first: a row that already exists is returned without calling TMDB.
// (Before, every film page view fetched TMDB detail even on a cache hit —
// only Next's fetch cache stood between page views and the TMDB quota.)
// Film metadata is effectively immutable, so rows aren't refreshed.
//
// Insert path is rate limited: any anonymous visitor can reach it by
// requesting /film/<any id>, and each miss costs a TMDB call plus a row in
// a table that is never pruned. Two budgets:
//   per client  — one visitor (IP, or user on /write/new) can't walk ids
//   global      — a distributed crawl still can't grow the table unbounded
// Hitting either returns "rate_limited" so the page can say "try again"
// instead of a misleading 404.
//
// Uses the admin (service-role) client because films is reference data, not
// per-user content. The alternative — an authenticated insert policy — would
// trade a tiny write-path surface for a whole class of user-attributable
// spam, without protecting anyone.

const RATE_INSERT_CLIENT = { max: 30, windowMs: 10 * 60_000 };
const RATE_INSERT_GLOBAL = { max: 1000, windowMs: 60 * 60_000 };

export type FilmLookup =
  | { ok: true; film: Film }
  | { ok: false; reason: "not_found" | "rate_limited" };

async function lookup(tmdbId: number, clientKey: string): Promise<FilmLookup> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return { ok: false, reason: "not_found" };
  }

  const admin = createAdminClient();

  const existing = await admin
    .from("films")
    .select("*")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return { ok: true, film: existing.data };

  for (const [key, rate] of [
    [`film-insert:${clientKey}`, RATE_INSERT_CLIENT],
    ["film-insert:global", RATE_INSERT_GLOBAL],
  ] as const) {
    const limit = await checkRateLimit(key, rate);
    if (!limit.ok) return { ok: false, reason: "rate_limited" };
  }

  let tmdb;
  try {
    tmdb = await getFilm(tmdbId);
  } catch (err) {
    // TMDB returned 4xx — most likely an unknown id. Surface as not-found.
    console.error("TMDB getFilm failed:", err);
    return { ok: false, reason: "not_found" };
  }

  // Upsert on tmdb_id in case two requests raced here; the unique index
  // coalesces them.
  const { data, error } = await admin
    .from("films")
    .upsert(
      {
        tmdb_id: tmdb.tmdbId,
        title: tmdb.title,
        year: tmdb.year,
        director: tmdb.director,
        runtime_minutes: tmdb.runtimeMinutes,
        overview: tmdb.overview || null,
        poster_path: tmdb.posterPath,
        backdrop_path: tmdb.backdropPath,
        original_language: tmdb.originalLanguage,
      },
      { onConflict: "tmdb_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return { ok: true, film: data };
}

// React cache() dedups within one request: the film page calls this from
// both generateMetadata and the page body, which would otherwise mean two
// reads, and on a miss, two rate-limit hits for one page view.
export const getOrCreateFilmByTmdbId = cache(lookup);
