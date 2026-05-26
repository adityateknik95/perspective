"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

interface AvatarMenuProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

// Popover menu anchored to the avatar. Dismisses on outside click, Escape, or
// route change. Sign out goes through the browser client so the cookie clear
// happens alongside the in-memory state.
export function AvatarMenu({
  username,
  displayName,
  avatarUrl,
}: AvatarMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
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

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    // Force server components to re-render with the unauthenticated state.
    router.refresh();
    router.push("/");
  }, [router]);

  const initials = (displayName || username).slice(0, 2);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center gap-3 rounded-sm p-1 transition-colors hover:bg-cream-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
      >
        <Avatar src={avatarUrl} alt="" size={32} fallback={initials} />
        <span className="hidden font-mono text-meta-sm uppercase text-ink-soft group-hover:text-ink sm:inline">
          @{username}
        </span>
      </button>

      <div
        id={menuId}
        role="menu"
        aria-hidden={!open}
        className={cn(
          "absolute right-0 z-50 mt-2 w-56 origin-top-right border border-rule bg-cream shadow-sm transition-opacity",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="border-b border-rule px-4 py-3">
          <p className="font-body text-reading text-ink">{displayName || username}</p>
          <p className="font-mono text-meta-sm uppercase text-ink-muted">
            @{username}
          </p>
        </div>
        <ul className="py-2 text-sm">
          <MenuItem href="/home" onClick={() => setOpen(false)}>
            Home
          </MenuItem>
          <MenuItem href={`/${username}`} onClick={() => setOpen(false)}>
            View profile
          </MenuItem>
          <MenuItem href="/settings" onClick={() => setOpen(false)}>
            Settings
          </MenuItem>
          <li role="none">
            <button
              role="menuitem"
              type="button"
              onClick={handleSignOut}
              className="block w-full px-4 py-2 text-left font-mono text-meta-sm uppercase text-wine hover:bg-cream-deep"
            >
              Sign out
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

function MenuItem({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li role="none">
      <Link
        role="menuitem"
        href={href}
        onClick={onClick}
        className="block px-4 py-2 font-mono text-meta-sm uppercase text-ink-soft hover:bg-cream-deep hover:text-ink"
      >
        {children}
      </Link>
    </li>
  );
}
