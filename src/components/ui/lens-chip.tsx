"use client";

import { cn } from "@/lib/cn";
import type { Lens } from "@/lib/lenses";

interface LensChipProps {
  lens: Lens;
  selected: boolean;
  disabled?: boolean;
  onToggle: (lens: Lens) => void;
}

// A checkbox-flavoured chip. We use role="checkbox" + aria-checked so screen
// readers announce state changes, and keep tab order by making it a <button>.
export function LensChip({ lens, selected, disabled, onToggle }: LensChipProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled && !selected}
      onClick={() => onToggle(lens)}
      className={cn(
        "inline-flex h-9 items-center gap-2 border px-3 font-mono text-meta-sm uppercase tracking-[0.15em] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
        selected
          ? "border-wine bg-wine text-cream hover:bg-wine-deep"
          : "border-rule text-ink hover:border-ink-soft hover:bg-cream-deep",
        !selected && disabled && "cursor-not-allowed opacity-40 hover:border-rule hover:bg-transparent",
      )}
    >
      <span aria-hidden>{selected ? "\u2022" : "\u00b7"}</span>
      {lens}
    </button>
  );
}
