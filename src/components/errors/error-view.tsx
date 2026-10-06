"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonClassName } from "@/components/ui/button";
import type { ClientErrorInput } from "@/lib/validation/client-error";

interface ErrorViewProps {
  error: Error & { digest?: string };
  reset: () => void;
  boundary: ClientErrorInput["boundary"];
}

// Shared body for error.tsx / global-error.tsx. Reports the error once per
// distinct error, then offers a retry and a way home. In production, server
// errors arrive here redacted to a generic message plus a digest; the digest
// is shown so a reader's report can be matched to the server log.
export function ErrorView({ error, reset, boundary }: ErrorViewProps) {
  useEffect(() => {
    const report: ClientErrorInput = {
      name: error.name,
      message: error.message || "Unknown error",
      digest: error.digest,
      path: window.location.pathname,
      boundary,
    };
    // keepalive lets the report finish even if the user navigates away.
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => {});
  }, [error, boundary]);

  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="font-mono text-meta-sm uppercase text-ink-muted">Something went wrong</p>
      <h1 className="mt-4 font-display text-display-md text-ink">
        This page didn&apos;t load<span className="italic">.</span>
      </h1>
      <p className="mt-4 font-body text-reading text-ink-soft">
        It&apos;s on our side, not yours. Trying again usually works; if it
        doesn&apos;t, your writing is safe and the rest of the site still is.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Link href="/" className={buttonClassName("secondary", "md")}>
          Go home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-8 font-mono text-meta-sm uppercase text-ink-muted">
          Reference {error.digest}
        </p>
      )}
    </div>
  );
}
