// The canonical lens catalog. Adding a lens is a product decision, not a
// user-configurable one — keeping this list closed preserves the editorial
// voice. Add new entries at the end to avoid reshuffling UI.
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
] as const;

export type Lens = (typeof LENSES)[number];

export function isLens(value: string): value is Lens {
  return (LENSES as readonly string[]).includes(value);
}

// Onboarding asks for 1–3 signature lenses.
export const MIN_SIGNATURE_LENSES = 1;
export const MAX_SIGNATURE_LENSES = 3;
