"use client";

import { ErrorView } from "@/components/errors/error-view";

// Errors inside the authed app shell. Living here (not just at the root)
// keeps the header and navigation on screen while the page itself fails.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorView error={error} reset={reset} boundary="app" />;
}
