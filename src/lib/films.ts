import "server-only";
import { getFilm } from "@/lib/tmdb/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Film } from "@/lib/types";
import type { FilmDetail } from "@/lib/tmdb/types";

// Returns the local films-row for a TMDB id, upserting from TMDB on first
// encounter. The row is the SSR source of truth for the film page and the
// FK target for perspectives.rows, so every /film/[tmdbId] render touches
// this path.
//
// Uses the admin (service-role) client because films is reference data, not
// per-user content. The alternative — an authenticated insert policy — would
// trade a tiny write-path surface for a whole class of user-attributable
// spam, without protecting anyone.
export async function getOrCreateFilmByTmdbId(
  tmdbId: number,
): Promise<{ film: Film; tmdb: FilmDetail } | null> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;

  const admin = createAdminClient();

  // Try read first — covers the common case after the film has been cached.
  const existing = await admin
    .from("films")
    .select("*")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (existing.error && existing.error.code !== "PGRST116") {
    throw existing.error;
  }

  let tmdb: FilmDetail;
  try {
    tmdb = await getFilm(tmdbId);
  } catch (err) {
    // TMDB returned 4xx — most likely an unknown id. Surface as not-found.
    console.error("TMDB getFilm failed:", err);
    return null;
  }

  if (existing.data) {
    return { film: existing.data, tmdb };
  }

  // First time we've seen this id — insert. Use upsert on tmdb_id in case
  // two requests raced here; the unique index will coalesce them.
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
  return { film: data, tmdb };
}
