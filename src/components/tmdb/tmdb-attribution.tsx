"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  TMDB_LOGO_HEIGHT_PX,
  TMDB_LOGO_PATH,
  TMDB_NOTICE,
  TMDB_URL,
} from "@/lib/tmdb/attribution";

interface TmdbAttributionProps {
  // "footer": the full notice; "film": a shorter credit that still carries
  // the notice, sized for the film page's metadata column.
  variant?: "footer" | "film";
  className?: string;
}

// TMDB logo + required notice (src/lib/tmdb/attribution.ts has the rules).
// The logo is the official file at /tmdb-logo.svg; until it's added the
// <img> errors and hides itself, leaving the text notice, rather than
// showing a broken image or a home-made imitation of TMDB's mark.
export function TmdbAttribution({ variant = "footer", className }: TmdbAttributionProps) {
  const [logoOk, setLogoOk] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  // onError alone misses failures that happen before hydration (the <img>
  // is in the server HTML, so the browser can give up on it before React
  // attaches the handler). Check once after mount as well.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setLogoOk(false);
  }, []);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-meta-sm normal-case tracking-normal text-ink-muted",
        className,
      )}
    >
      {logoOk && (
        <a href={TMDB_URL} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG from /public; next/image adds nothing here */}
          <img
            ref={imgRef}
            src={TMDB_LOGO_PATH}
            alt="TMDB"
            height={TMDB_LOGO_HEIGHT_PX}
            style={{ height: TMDB_LOGO_HEIGHT_PX, width: "auto" }}
            onError={() => setLogoOk(false)}
          />
        </a>
      )}
      <p>
        {variant === "film" ? "Film details and images from " : null}
        {variant === "film" ? (
          <a href={TMDB_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
            TMDB
          </a>
        ) : null}
        {variant === "film" ? ". " : null}
        {TMDB_NOTICE}
      </p>
    </div>
  );
}
