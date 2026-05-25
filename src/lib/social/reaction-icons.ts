// Lucide icon assignments for each reaction type. Kept separate from
// reactions.ts so the constants module stays free of React/Lucide imports —
// it gets pulled into RPC argument validation, server queries, etc., none of
// which should bundle SVG components.
//
// Choices (mostly metaphorical, some practical):
//   moved              → Sparkles  (the "I'm shimmering" feeling)
//   changed_my_mind    → Compass   (re-orientation)
//   recognized_myself  → Eye       (self-recognition; Mirror isn't in Lucide)
//   saw_it_differently → GitBranch (a fork in interpretation)
//   stayed_with_me     → Anchor    (it lodged and didn't let go)

import { Anchor, Compass, Eye, GitBranch, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactionType } from "@/lib/social/reactions";

export const REACTION_ICONS: Record<ReactionType, LucideIcon> = {
  moved: Sparkles,
  changed_my_mind: Compass,
  recognized_myself: Eye,
  saw_it_differently: GitBranch,
  stayed_with_me: Anchor,
};
