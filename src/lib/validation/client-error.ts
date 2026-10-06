import { z } from "./zod";

// What the error boundaries send to /api/client-error. Shared so the
// browser builds exactly what the endpoint accepts. Everything is bounded:
// the endpoint is public, and a report is a note, not a payload.
export const clientErrorSchema = z.object({
  name: z.string().max(200).optional(),
  message: z.string().max(1000),
  // Next's server-error digest: the only link between a redacted client
  // error and the full server log line.
  digest: z.string().max(100).optional(),
  path: z.string().max(500).optional(),
  boundary: z.enum(["app", "root", "global"]),
});

export type ClientErrorInput = z.infer<typeof clientErrorSchema>;
