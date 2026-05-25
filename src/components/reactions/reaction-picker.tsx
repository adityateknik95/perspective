"use client";

import { useOptimistic, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  REACTION_TYPES,
  REACTION_LABELS,
  REACTION_SUMMARY_PHRASES,
  REACTION_SUMMARY_PHRASES_SINGULAR,
  applyOptimisticReaction,
  type ReactionSummary,
  type ReactionType,
} from "@/lib/social/reactions";
import { REACTION_ICONS } from "@/lib/social/reaction-icons";
import { setReactionAction } from "@/app/(app)/perspective/[perspectiveId]/reactions-action";
import { cn } from "@/lib/cn";

interface ReactionPickerProps {
  perspectiveId: string;
  // null = viewer hasn't reacted (or isn't signed in).
  initialViewerReaction: ReactionType | null;
  initialSummary: ReactionSummary;
  // When false the picker renders a sign-in CTA instead of buttons.
  isSignedIn: boolean;
  // Where to send unauthenticated readers when they click a reaction.
  signInHref: string;
}

// Render the "42 people were moved · 18 changed their mind" line under the
// picker. Inlined from summarySentence() so we can highlight the type the
// viewer is currently on (if any) without re-parsing the string.
function SummaryLine({
  summary,
  highlight,
}: {
  summary: ReactionSummary;
  highlight: ReactionType | null;
}) {
  const parts: { type: ReactionType; text: string }[] = [];
  for (const t of REACTION_TYPES) {
    const n = summary[t];
    if (n === 0) continue;
    const phrase =
      n === 1 ? REACTION_SUMMARY_PHRASES_SINGULAR[t] : REACTION_SUMMARY_PHRASES[t];
    const noun = n === 1 ? "person" : "people";
    parts.push({ type: t, text: `${n.toLocaleString()} ${noun} ${phrase}` });
  }

  if (parts.length === 0) {
    return (
      <p className="font-mono text-meta-sm uppercase text-ink-muted">
        Be the first to react.
      </p>
    );
  }

  return (
    <p className="font-mono text-meta-sm uppercase text-ink-muted">
      {parts.map((p, i) => (
        <span key={p.type}>
          <span
            className={cn(
              p.type === highlight && "text-ink",
            )}
          >
            {p.text}
          </span>
          {i < parts.length - 1 && <span aria-hidden> · </span>}
        </span>
      ))}
    </p>
  );
}

// The five-button reactions row + summary line. Source of truth for the
// viewer's current reaction is the optimistic state; the parent server
// component re-renders with the new server value after revalidatePath.
export function ReactionPicker({
  perspectiveId,
  initialViewerReaction,
  initialSummary,
  isSignedIn,
  signInHref,
}: ReactionPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Track the viewer's reaction optimistically. We pair it with a derived
  // summary so the count line moves the moment the user clicks.
  const [optimisticReaction, setOptimisticReaction] = useOptimistic<
    ReactionType | null,
    ReactionType | null
  >(initialViewerReaction, (_state, next) => next);

  const optimisticSummary = applyOptimisticReaction(
    initialSummary,
    initialViewerReaction,
    optimisticReaction,
  );

  function onPick(type: ReactionType) {
    if (!isSignedIn) {
      router.push(signInHref);
      return;
    }
    setErrorMsg(null);

    // Toggle: clicking the active reaction clears it.
    const next: ReactionType | null = optimisticReaction === type ? null : type;

    startTransition(async () => {
      setOptimisticReaction(next);
      const result = await setReactionAction({
        perspectiveId,
        reactionType: next,
      });
      if (!result.ok) {
        // Roll back to the server-known state. The optimistic hook resets
        // automatically when the transition unwinds, but we also surface
        // the error so the user knows something went wrong.
        setErrorMsg(result.error);
      }
    });
  }

  return (
    <section
      aria-label="Reactions"
      className="border-t border-rule pt-8"
    >
      <p className="font-mono text-meta-sm uppercase text-ink-muted">
        How did this land?
      </p>

      {/* Icon-resting picker: at rest each reaction is a quiet 40×40
          square; the active reaction expands to a full pill with its
          label so the viewer's pick is declarative. The other buttons
          stay icon-only, which keeps the chrome from drowning the
          drop-cap prose above. Tooltip on title + aria-label covers
          discoverability without a layout-shifting hover state. */}
      <div
        role="radiogroup"
        aria-label="Choose a reaction"
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        {REACTION_TYPES.map((type) => {
          const Icon = REACTION_ICONS[type];
          const isActive = optimisticReaction === type;
          const label = REACTION_LABELS[type];
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={label}
              title={label}
              onClick={() => onPick(type)}
              disabled={isPending}
              className={cn(
                "inline-flex h-10 items-center justify-center border font-mono text-meta-sm uppercase tracking-[0.12em] transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                "disabled:cursor-not-allowed disabled:opacity-60",
                isActive
                  ? "gap-2 border-wine bg-wine px-3 text-cream hover:bg-wine-deep"
                  : "w-10 border-rule bg-transparent text-ink-soft hover:border-ink-soft hover:bg-cream-deep hover:text-ink",
              )}
            >
              <Icon
                size={16}
                strokeWidth={1.75}
                aria-hidden
                className="shrink-0"
              />
              {isActive && <span>{label}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <SummaryLine
          summary={optimisticSummary}
          highlight={optimisticReaction}
        />
      </div>

      {errorMsg && (
        <p
          role="alert"
          className="mt-2 font-mono text-meta-sm uppercase text-wine"
        >
          {errorMsg}
        </p>
      )}
    </section>
  );
}
