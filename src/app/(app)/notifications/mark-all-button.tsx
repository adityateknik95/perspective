"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllAsReadAction } from "./actions";
import { buttonClassName } from "@/components/ui/button";

interface MarkAllButtonProps {
  // The page already knows the unread count — if zero, the button stays
  // disabled rather than vanishing, so the layout doesn't shift when the
  // last row gets dismissed.
  unreadCount: number;
}

// Tucked top-right of the inbox. Fires the bulk-update action and then
// router.refresh() so the rows re-render with read state + the bell badge
// drops to zero. Errors surface inline so the user sees what happened
// instead of a silent no-op.
export function MarkAllButton({ unreadCount }: MarkAllButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled = unreadCount === 0 || isPending;

  function onClick() {
    setError(null);
    startTransition(async () => {
      const result = await markAllAsReadAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // revalidatePath in the action handles /notifications, but the
      // bell lives on the layout — refresh nudges Next to re-fetch the
      // current tree including the layout's server components.
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={buttonClassName("ghost", "sm")}
      >
        {isPending ? "Marking…" : "Mark all as read"}
      </button>
      {error && (
        <p role="alert" className="font-mono text-meta-sm uppercase text-wine">
          {error}
        </p>
      )}
    </div>
  );
}
