"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import {
  revertToDraftAction,
  togglePrivacyAction,
  deleteSharedAction,
} from "@/app/(app)/write/[perspectiveId]/actions";
import { cn } from "@/lib/cn";

interface OwnerActionsProps {
  perspectiveId: string;
  isDraft: boolean;
  isPrivate: boolean;
}

// Owner controls on the read view, collapsed into a "···" menu so they
// don't crowd the byline. Three actions:
//   Edit            — reverts to draft (published is immutable) then routes
//                     to the editor. On a draft, goes straight there.
//   Privacy toggle  — flips public/private without the full Share dialog.
//                     Hidden on drafts (privacy only means something once
//                     a piece is shared).
//   Delete          — hard delete, with confirm. Works on drafts + shared.
//
// The menu mirrors the AvatarMenu pattern: outside-click + Escape dismiss.
export function OwnerActions({
  perspectiveId,
  isDraft,
  isPrivate,
}: OwnerActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onEdit() {
    setOpen(false);
    if (isDraft) {
      router.push(`/write/${perspectiveId}`);
      return;
    }
    if (
      !confirm(
        "Reopen for editing? This takes the piece back to a draft until you re-share.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await revertToDraftAction(perspectiveId);
      if (result.ok) router.push(`/write/${perspectiveId}`);
      else setError(result.error);
    });
  }

  function onTogglePrivacy() {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await togglePrivacyAction(perspectiveId, !isPrivate);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function onDelete() {
    setOpen(false);
    if (
      !confirm(
        "Delete this perspective? This can't be undone — the piece and its responses go with it.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteSharedAction(perspectiveId);
      if (result.ok) {
        router.push(result.data?.username ? `/${result.data.username}` : "/home");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Perspective options"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors",
          "hover:bg-cream-deep hover:text-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden />
      </button>

      <div
        id={menuId}
        role="menu"
        aria-hidden={!open}
        className={cn(
          "absolute right-0 z-50 mt-2 w-52 origin-top-right border border-rule bg-cream shadow-sm transition-opacity",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ul className="py-2">
          <MenuButton onClick={onEdit}>Edit</MenuButton>
          {!isDraft && (
            <MenuButton onClick={onTogglePrivacy}>
              {isPrivate ? "Make public" : "Make private"}
            </MenuButton>
          )}
          <li role="separator" className="my-1 border-t border-rule" />
          <li role="none">
            <button
              role="menuitem"
              type="button"
              onClick={onDelete}
              className="block w-full px-4 py-2 text-left font-mono text-meta-sm uppercase text-wine hover:bg-cream-deep"
            >
              Delete
            </button>
          </li>
        </ul>
      </div>

      {error && (
        <p
          role="alert"
          className="absolute right-0 top-full mt-1 w-52 font-mono text-meta-sm uppercase text-wine"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function MenuButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li role="none">
      <button
        role="menuitem"
        type="button"
        onClick={onClick}
        className="block w-full px-4 py-2 text-left font-mono text-meta-sm uppercase text-ink-soft hover:bg-cream-deep hover:text-ink"
      >
        {children}
      </button>
    </li>
  );
}
