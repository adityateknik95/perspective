"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { revertToDraftAction } from "@/app/(app)/write/[perspectiveId]/actions";

interface OwnerActionsProps {
  perspectiveId: string;
  isDraft: boolean;
  isPrivate: boolean;
}

// Edit flow: clicking Edit on a published perspective reverts it to a draft,
// then bounces to the editor. That's the user-visible contract — "published
// is immutable until I explicitly reopen it" — so accidents can't silently
// ship a half-finished edit.
//
// For drafts we skip the revert and go straight to /write/[id].
export function OwnerActions({
  perspectiveId,
  isDraft,
}: OwnerActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onEdit() {
    if (isDraft) {
      router.push(`/write/${perspectiveId}`);
      return;
    }

    if (
      !confirm(
        "Reopen for editing? This takes the piece back to a draft until you re-publish.",
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await revertToDraftAction(perspectiveId);
      if (result.ok) {
        router.push(`/write/${perspectiveId}`);
      } else {
        // Surface the error with a toast-ish fallback. We don't have a
        // toast library yet — alert is acceptable for the rare failure path.
        alert(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={onEdit}
        disabled={isPending}
      >
        {isPending ? "Opening…" : "Edit"}
      </Button>
    </div>
  );
}
