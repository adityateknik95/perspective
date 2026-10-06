"use client";

import "./globals.css";
import { ErrorView } from "@/components/errors/error-view";

// Last resort: the root layout itself threw. This replaces the whole
// document, so it renders its own <html>/<body> (no fonts or theme script —
// those live in the layout that just failed).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream font-body text-ink antialiased">
        <ErrorView error={error} reset={reset} boundary="global" />
      </body>
    </html>
  );
}
