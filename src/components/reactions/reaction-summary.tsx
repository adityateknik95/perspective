import {
  REACTION_LABELS,
  dominantReaction,
  type ReactionSummary,
} from "@/lib/social/reactions";
import { REACTION_ICONS } from "@/lib/social/reaction-icons";
import { cn } from "@/lib/cn";

interface ReactionSummaryBadgeProps {
  summary: ReactionSummary;
  className?: string;
}

// Compact list-view badge: `<dominant-icon> 47`. Used on perspective cards
// in feeds and on profile/film pages. Renders nothing if total === 0 so we
// don't print "0" all over the place for fresh posts.
//
// Server component — no interactivity. The full picker lives on the read view.
export function ReactionSummaryBadge({
  summary,
  className,
}: ReactionSummaryBadgeProps) {
  if (summary.total === 0) return null;

  const dominant = dominantReaction(summary);
  const Icon = dominant ? REACTION_ICONS[dominant] : null;
  const label = dominant ? REACTION_LABELS[dominant] : "Reactions";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-meta-sm uppercase text-ink-muted",
        className,
      )}
      title={`${summary.total.toLocaleString()} ${
        summary.total === 1 ? "reaction" : "reactions"
      } — most: ${label}`}
    >
      {Icon && (
        <Icon
          size={12}
          strokeWidth={1.75}
          aria-hidden
          className="shrink-0"
        />
      )}
      <span>{summary.total.toLocaleString()}</span>
    </span>
  );
}
