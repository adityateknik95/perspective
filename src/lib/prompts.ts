// Rotating prompts displayed at the top of the writing view. The phrasing is
// deliberate — each one asks for an observation, not a verdict. No ratings
// language. One is picked per session (stable for the life of a draft).
export const WRITING_PROMPTS = [
  "What did it make you *see* that you hadn't before?",
  "What scene did you carry out of the theatre?",
  "Whose memory did it dig up?",
  "What would you tell the person sitting next to you, if they let you?",
  "Where did the film stop being about the film?",
  "What stayed with you on the walk home?",
  "What would you write back to the director, if you could?",
  "What lens were you watching through?",
] as const;

export function pickPrompt(seed: string): string {
  // Stable per-seed selection so the prompt doesn't flicker on re-render.
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % WRITING_PROMPTS.length;
  return WRITING_PROMPTS[idx];
}
