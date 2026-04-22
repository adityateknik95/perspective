import type { z } from "zod";

// Every server action in this app returns one of these instead of throwing.
// Callers can narrow on `ok` and get field-level errors for form UX.
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Collapses a ZodError into { field -> first-message } for display in forms.
export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
