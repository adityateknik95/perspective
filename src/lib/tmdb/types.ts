// TMDB response shapes. We only model what we consume.

export interface TmdbSearchResult {
  id: number;
  title: string;
  original_title: string;
  release_date: string; // "YYYY-MM-DD" or "" if unknown
  poster_path: string | null;
  overview: string;
  original_language: string;
  popularity: number;
}

export interface TmdbSearchResponse {
  page: number;
  results: TmdbSearchResult[];
  total_results: number;
  total_pages: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  order: number;
}

export interface TmdbCredits {
  id: number;
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}

export interface TmdbMovieDetail {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  runtime: number | null;
  original_language: string;
  credits?: TmdbCredits;
  tagline?: string;
}

// The normalized shapes our app deals in. TMDB field names sneak in elsewhere
// otherwise, which makes the call sites messy.

export interface FilmSummary {
  tmdbId: number;
  title: string;
  year: number | null;
  director: string | null;
  posterPath: string | null;
  originalLanguage: string;
}

export interface FilmDetail extends FilmSummary {
  overview: string;
  runtimeMinutes: number | null;
  backdropPath: string | null;
}
