// The canonical lens catalog. Adding a lens is a product decision, not a
// user-configurable one — keeping this list closed preserves the editorial
// voice. Add new entries at the end to avoid reshuffling UI.
//
// The DB enforces the same list via a check constraint on perspectives.lens_tags
// (see supabase/migrations/0002_films_perspectives.sql). When you add a lens
// here, add it to the migration's ALLOWED_LENSES list too — otherwise inserts
// with the new lens will be rejected by Postgres.
export const LENSES = [
  "grief",
  "memory",
  "craft",
  "denial",
  "family",
  "politics",
  "solitude",
  "childhood",
  "self",
  "faith",
  "work",
  "place",
  "desire",
  "violence",
  "longing",
  "time",
  "language",
  "sound",
] as const;

export type Lens = (typeof LENSES)[number];

export function isLens(value: string): value is Lens {
  return (LENSES as readonly string[]).includes(value);
}

// Onboarding asks for 1–3 signature lenses. Perspectives also take 1–3 lens
// tags (reusing the same bounds keeps the product feel consistent).
export const MIN_SIGNATURE_LENSES = 1;
export const MAX_SIGNATURE_LENSES = 3;

export const MIN_PERSPECTIVE_LENSES = 1;
export const MAX_PERSPECTIVE_LENSES = 3;
