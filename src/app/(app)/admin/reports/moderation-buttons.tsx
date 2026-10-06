"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ModerationTarget } from "@/lib/validation/moderation";
import type { ActionResult } from "@/lib/action-result";
import {
  dismissReportsAction,
  hideContentAction,
  unhideContentAction,
} from "./actions";

type Kind = "hide" | "dismiss" | "unhide";

const ACTIONS: Record<Kind, (t: ModerationTarget) => Promise<ActionResult>> = {
  hide: hideContentAction,
  dismiss: dismissReportsAction,
  unhide: unhideContentAction,
};

const LABELS: Record<Kind, string> = {
  hide: "Hide",
  dismiss: "Dismiss reports",
  unhide: "Unhide",
};

export function ModerationButtons({
  target,
  kinds,
}: {
  target: ModerationTarget;
  kinds: Kind[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {kinds.map((kind) => (
        <Button
          key={kind}
          size="sm"
          variant={kind === "hide" ? "primary" : "secondary"}
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await ACTIONS[kind](target);
              if (!result.ok) setError(result.error);
              else router.refresh();
            });
          }}
        >
          {LABELS[kind]}
        </Button>
      ))}
      {error && (
        <p role="alert" className="font-mono text-meta-sm uppercase text-wine">
          {error}
        </p>
      )}
    </div>
  );
}
