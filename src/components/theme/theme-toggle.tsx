"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/cn";

// Three-state preference. `system` defers to prefers-color-scheme; the
// resolved appearance still flips between light and dark with the OS.
type ThemePref = "light" | "dark" | "system";

const STORAGE_KEY = "perspective-theme";
const CYCLE: ThemePref[] = ["light", "dark", "system"];

// Read the persisted preference. Returns `system` when nothing's saved —
// matches the pre-hydration script's "fall through to OS" behavior so the
// in-app state agrees with what's on screen.
function readPref(): ThemePref {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // localStorage blocked — treat as system.
  }
  return "system";
}

// Apply the chosen preference to <html>. Pure side effect — the toggle's
// state itself drives the icon, this just keeps the DOM in sync.
function applyPref(pref: ThemePref) {
  const html = document.documentElement;
  const prefersDark =
    pref === "dark" ||
    (pref === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (prefersDark) {
    html.setAttribute("data-theme", "dark");
  } else {
    html.removeAttribute("data-theme");
  }
}

interface ThemeToggleProps {
  className?: string;
  // Compact button suits the header; "labeled" mode shows the preference
  // text alongside the icon — reserved for settings, not used yet.
  variant?: "icon" | "labeled";
}

// Cycles light → dark → system on each click. We deliberately don't open a
// menu — three options × one click is faster than three options × dropdown.
// The icon reflects the *preference* (not the resolved theme), so a user on
// system mode with dark OS sees the monitor icon, not the moon. Hover/aria
// labels explain what the next click will do.
export function ThemeToggle({ className, variant = "icon" }: ThemeToggleProps) {
  // Render in an undefined state first so SSR HTML is stable across users;
  // we hydrate to the real value on mount. The button is interactive either
  // way — clicking before hydration finishes is just a no-op for one frame.
  const [pref, setPref] = useState<ThemePref | null>(null);

  useEffect(() => {
    setPref(readPref());
    // Track OS-level changes when in system mode — otherwise the page
    // would lag the OS until the next click.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readPref() === "system") applyPref("system");
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  function cycle() {
    const current = pref ?? readPref();
    const idx = CYCLE.indexOf(current);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setPref(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Same as elsewhere — silent on localStorage block.
    }
    applyPref(next);
  }

  // Until hydration completes we show a moon-ish neutral so SSR doesn't
  // need to guess. After mount the right icon snaps in.
  const display: ThemePref = pref ?? "system";
  const { Icon, label, nextLabel } = displayFor(display);

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${label}. Click to switch to ${nextLabel}.`}
      title={`Theme: ${label}`}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-full text-ink-soft transition-colors",
        "hover:bg-cream-deep hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
        variant === "icon" ? "w-9" : "gap-2 px-3",
        className,
      )}
    >
      <Icon size={18} strokeWidth={1.75} aria-hidden />
      {variant === "labeled" && (
        <span className="font-mono text-meta-sm uppercase">{label}</span>
      )}
    </button>
  );
}

function displayFor(pref: ThemePref): {
  Icon: typeof Sun;
  label: string;
  nextLabel: string;
} {
  const idx = CYCLE.indexOf(pref);
  const next = CYCLE[(idx + 1) % CYCLE.length];
  const labels: Record<ThemePref, string> = {
    light: "Light",
    dark: "Dark",
    system: "System",
  };
  const icons: Record<ThemePref, typeof Sun> = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  };
  return {
    Icon: icons[pref],
    label: labels[pref],
    nextLabel: labels[next],
  };
}
