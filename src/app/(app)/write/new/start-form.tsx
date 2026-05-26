"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilmSearch } from "@/components/film-search";
import type { FilmSummary } from "@/lib/tmdb/types";

interface StartFormProps {
  error?: string;
}

// Fallback view for /write/new with no (or bad) film param. The user picks
// a film, and we bounce back through /write/new?film=<tmdbId> — so the
// draft-creation logic lives in a single place (the server page).
export function StartForm({ error }: StartFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function onSelect(film: FilmSummary) {
    setBusy(true);
    startTransition(() => {
      router.replace(`/write/new?film=${film.tmdbId}`);
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <p className="font-mono text-meta-sm uppercase text-ink-muted">
        New perspective
      </p>
      <h1 className="mt-6 font-display text-display-lg text-ink">
        What did you watch<span className="italic">?</span>
      </h1>
      <p className="mt-4 max-w-prose font-body text-reading text-ink-soft">
        Search for the film first. We&apos;ll start a draft for you — no
        commitment, nothing is shared until you say so.
      </p>

      <div className="mt-10">
        <FilmSearch
          onSelect={onSelect}
          autoFocus
          busy={busy}
          placeholder="Search for a film…"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 font-mono text-meta-sm uppercase text-wine"
        >
          {error}
        </p>
      )}
    </div>
  );
}
