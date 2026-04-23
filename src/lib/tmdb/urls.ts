// TMDB image CDN helpers. Safe for client use — no token involved.

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export type PosterSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original";
export type BackdropSize = "w300" | "w780" | "w1280" | "original";

export function posterUrl(
  path: string | null | undefined,
  size: PosterSize = "w342",
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function backdropUrl(
  path: string | null | undefined,
  size: BackdropSize = "w1280",
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}
