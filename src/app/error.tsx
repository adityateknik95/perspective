"use client";

import { ErrorView } from "@/components/errors/error-view";

// Errors in any route below the root layout that isn't under (app) — the
// auth pages, the landing page, design-system.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorView error={error} reset={reset} boundary="root" />;
}
