// Derived from the plaintext body of a perspective. Computed server-side —
// never trust the client's count.

const WORDS_PER_MINUTE = 220; // Medium's long-standing ballpark for prose.

export function wordCount(plaintext: string): number {
  const trimmed = plaintext.trim();
  if (trimmed.length === 0) return 0;
  // Matches any run of non-whitespace; handles unicode word chars well enough
  // without pulling in Intl.Segmenter.
  return (trimmed.match(/\S+/g) ?? []).length;
}

export function readingTimeMinutes(plaintext: string): number {
  const words = wordCount(plaintext);
  if (words === 0) return 0;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

// Pull a short preview from plaintext — used in list views and OG descriptions.
// Respects word boundaries and trims to avoid orphan articles.
export function excerpt(plaintext: string, maxWords = 40): string {
  const words = plaintext.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}\u2026`;
}
