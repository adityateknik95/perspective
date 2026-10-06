"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { confirmsUsername } from "@/lib/validation/profile";
import { deleteAccountAction } from "./delete-account-action";

interface DeleteAccountSectionProps {
  username: string;
}

// Kept separate from SettingsForm on purpose: it's a different form with a
// different submit, and it shouldn't be one stray Enter away from "Save".
export function DeleteAccountSection({ username }: DeleteAccountSectionProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const matches = confirmsUsername(confirmation, username);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldError(undefined);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      // On success the action redirects, so we only ever see failures here.
      const result = await deleteAccountAction(formData);
      if (result && !result.ok) {
        setError(result.error);
        setFieldError(result.fieldErrors?.confirmation);
      }
    });
  }

  return (
    <section
      aria-labelledby="delete-account-heading"
      className="mt-16 border-t border-rule pt-10"
    >
      <h2
        id="delete-account-heading"
        className="font-mono text-meta-sm uppercase text-ink-muted"
      >
        Delete account
      </h2>
      <p className="mt-3 font-body text-reading-sm text-ink-soft">
        This permanently deletes your profile, every perspective you&apos;ve
        written (drafts included), your reactions, responses and follows.
        Replies other people left under your responses stay, with your
        response shown as removed. This can&apos;t be undone.
      </p>

      {!open ? (
        <div className="mt-6">
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Delete my account…
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <Label htmlFor="delete-confirmation">
              Type <span className="font-mono">{username}</span> to confirm
            </Label>
            <Input
              id="delete-confirmation"
              name="confirmation"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby="delete-confirmation-error"
            />
            <FieldError id="delete-confirmation-error" message={fieldError} />
          </div>
          {error && !fieldError && (
            <p role="alert" className="font-mono text-meta-sm uppercase text-wine">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={!matches || isPending}>
              {isPending ? "Deleting…" : "Permanently delete"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setConfirmation("");
                setError(null);
                setFieldError(undefined);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
