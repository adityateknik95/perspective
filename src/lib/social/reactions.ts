// The five reaction types Perspective allows. Mirrors the CHECK constraint
// on public.reactions.reaction_type in 0004_social.sql — keep in lockstep.
//
// Order in this array is the canonical display order: it determines the
// left-to-right sequence in <ReactionPicker>, the iteration order in
// summary phrases, and the tiebreaker for "dominant" reaction on list
// views (first non-zero count wins).

export const REACTION_TYPES = [
  "moved",
  "changed_my_mind",
  "recognized_myself",
  "saw_it_differently",
  "stayed_with_me",
] as const;

export type ReactionType = (typeof REACTION_TYPES)[number];

export function isReactionType(value: string): value is ReactionType {
  return (REACTION_TYPES as readonly string[]).includes(value);
}

// Short labels for the picker buttons. Sentence-case, no punctuation.
export const REACTION_LABELS: Record<ReactionType, string> = {
  moved: "Moved",
  changed_my_mind: "Changed my mind",
  recognized_myself: "Recognized myself",
  saw_it_differently: "Saw differently",
  stayed_with_me: "Stayed with me",
};

// Verb forms used in notification sentences:
//   "**Maya** was moved by your perspective on *Past Lives*"
// Subject is always third-person singular ("Maya" / "they").
export const REACTION_VERBS: Record<ReactionType, string> = {
  moved: "was moved by",
  changed_my_mind: "changed their mind reading",
  recognized_myself: "recognized themselves in",
  saw_it_differently: "saw differently",
  stayed_with_me: "stayed with",
};

// Aggregate phrasing for the "42 people were moved · 18 changed their mind"
// summary line under the reaction picker. Plural ("people") form.
export const REACTION_SUMMARY_PHRASES: Record<ReactionType, string> = {
  moved: "were moved",
  changed_my_mind: "changed their mind",
  recognized_myself: "recognized themselves",
  saw_it_differently: "saw it differently",
  stayed_with_me: "stayed with it",
};

// Singular form for "1 person was moved". Used when count === 1.
export const REACTION_SUMMARY_PHRASES_SINGULAR: Record<ReactionType, string> = {
  moved: "was moved",
  changed_my_mind: "changed their mind",
  recognized_myself: "recognized themselves",
  saw_it_differently: "saw it differently",
  stayed_with_me: "stayed with it",
};

export type ReactionSummary = {
  moved: number;
  changed_my_mind: number;
  recognized_myself: number;
  saw_it_differently: number;
  stayed_with_me: number;
  total: number;
};

export const EMPTY_REACTION_SUMMARY: ReactionSummary = {
  moved: 0,
  changed_my_mind: 0,
  recognized_myself: 0,
  saw_it_differently: 0,
  stayed_with_me: 0,
  total: 0,
};

// Pick the "dominant" reaction for compact list-view badges.
// Tiebreaker is canonical order — REACTION_TYPES[0] beats REACTION_TYPES[1]
// at equal counts. Returns null if there are no reactions.
export function dominantReaction(
  summary: ReactionSummary,
): ReactionType | null {
  if (summary.total === 0) return null;
  let best: ReactionType = REACTION_TYPES[0];
  let bestN = -1;
  for (const t of REACTION_TYPES) {
    if (summary[t] > bestN) {
      best = t;
      bestN = summary[t];
    }
  }
  return bestN > 0 ? best : null;
}

// Render the "42 people were moved · 18 changed their mind · 7 saw it
// differently" line. Skips zero-count types. Returns "" if the perspective
// has no reactions yet.
export function summarySentence(summary: ReactionSummary): string {
  const parts: string[] = [];
  for (const t of REACTION_TYPES) {
    const n = summary[t];
    if (n === 0) continue;
    const phrase =
      n === 1 ? REACTION_SUMMARY_PHRASES_SINGULAR[t] : REACTION_SUMMARY_PHRASES[t];
    const noun = n === 1 ? "person" : "people";
    parts.push(`${n.toLocaleString()} ${noun} ${phrase}`);
  }
  return parts.join(" · ");
}
