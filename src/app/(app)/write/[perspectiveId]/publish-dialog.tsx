"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LensChip } from "@/components/ui/lens-chip";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LENSES,
  MAX_PERSPECTIVE_LENSES,
  type Lens,
} from "@/lib/lenses";
import { publishAction } from "./actions";

interface Snapshot {
  title: string;
  subtitle: string;
  body: string;
}

interface PublishDialogProps {
  perspectiveId: string;
  initialLenses: Lens[];
  initialIsPrivate: boolean;
  getSnapshot: () => Snapshot;
  onClose: () => void;
}

// The publish dialog is the quality gate. It blocks submission until the
// piece has a title, at least one lens, and a non-empty body — so we never
// show readers a draft-shaped thing labelled "published".
export function PublishDialog({
  perspectiveId,
  initialLenses,
  initialIsPrivate,
  getSnapshot,
  onClose,
}: PublishDialogProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<Lens>>(
    () => new Set(initialLenses),
  );
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Escape to close. Focus-trap is intentionally simple — the dialog has
  // few tabbables so native tab order is enough.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, isPending]);

  // Grab the snapshot once on open so the title preview reflects the
  // editor state at the moment of clicking "Publish…".
  const openSnapshot = useRef<Snapshot | null>(null);
  if (openSnapshot.current === null) {
    openSnapshot.current = getSnapshot();
  }
  const currentTitle =
    titleOverride !== null ? titleOverride : openSnapshot.current.title;

  function toggleLens(lens: Lens) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lens)) next.delete(lens);
      else if (next.size < MAX_PERSPECTIVE_LENSES) next.add(lens);
      return next;
    });
    if (errors.lens_tags) {
      setErrors((prev) => {
        // Clear the lens error as soon as the user starts picking.
        const { lens_tags, ...rest } = prev;
        void lens_tags;
        return rest;
      });
    }
  }

  function onSubmit() {
    setFormError(null);
    const snapshot = getSnapshot();
    const resolvedTitle = titleOverride !== null ? titleOverride : snapshot.title;

    startTransition(async () => {
      const result = await publishAction(perspectiveId, {
        title: resolvedTitle,
        subtitle: snapshot.subtitle || undefined,
        body: snapshot.body,
        lens_tags: Array.from(selected),
        is_private: isPrivate,
      });

      if (result.ok) {
        router.push(`/perspective/${result.data?.id ?? perspectiveId}`);
        return;
      }

      if (result.fieldErrors) setErrors(result.fieldErrors);
      setFormError(result.error);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6"
      onClick={(e) => {
        // Click on the backdrop closes, but only if the click originated
        // on the backdrop (not on the dialog that bubbled up).
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl border border-rule bg-cream p-8 shadow-lg"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="publish-dialog-title"
            className="font-display text-display-sm text-ink"
          >
            Publish<span className="italic">.</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="font-mono text-meta-sm uppercase text-ink-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        <p className="mt-2 font-body text-reading text-ink-soft">
          Everything below can be changed later by editing and re-publishing.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <Label htmlFor="publish-title">Title</Label>
            <Input
              id="publish-title"
              value={currentTitle}
              onChange={(e) => setTitleOverride(e.target.value)}
              invalid={!!errors.title}
              maxLength={120}
            />
            <FieldError message={errors.title} />
          </div>

          <div>
            <Label>
              Lenses{" "}
              <span className="text-ink-muted">
                ({selected.size}/{MAX_PERSPECTIVE_LENSES})
              </span>
            </Label>
            <div
              role="group"
              aria-label="Lens tags"
              className="mt-3 flex flex-wrap gap-2"
            >
              {LENSES.map((lens) => (
                <LensChip
                  key={lens}
                  lens={lens}
                  selected={selected.has(lens)}
                  disabled={
                    selected.size >= MAX_PERSPECTIVE_LENSES &&
                    !selected.has(lens)
                  }
                  onToggle={toggleLens}
                />
              ))}
            </div>
            <FieldError message={errors.lens_tags} />
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-3 font-body text-reading text-ink">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 accent-wine"
              />
              <span>
                Keep this private
                <span className="ml-2 font-mono text-meta-sm uppercase text-ink-muted">
                  Only you
                </span>
              </span>
            </label>
            <p className="mt-1 max-w-prose font-body text-reading-sm text-ink-soft">
              Private pieces don&apos;t appear on film pages or your public
              profile. You can flip this later by re-publishing.
            </p>
          </div>
        </div>

        {formError && (
          <p
            role="alert"
            className="mt-6 font-mono text-meta-sm uppercase text-wine"
          >
            {formError}
          </p>
        )}

        <div className="mt-8 flex items-center justify-end gap-3 border-t border-rule pt-6">
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onSubmit}
            disabled={isPending || selected.size === 0}
          >
            {isPending ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
