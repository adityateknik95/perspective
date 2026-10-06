import { z } from "zod";

// Startup validation for every environment variable the app reads.
//
// Before this, a missing key surfaced as a confusing runtime failure deep in
// a request ("Invalid URL" from @supabase/ssr, a 401 from TMDB on the first
// film page). validateEnv() runs once at server boot from
// src/instrumentation.ts and refuses to start with a list of everything
// that's wrong, so a bad deploy fails at deploy time instead of in front of
// a reader.
//
// Rules:
//   - Empty strings count as unset (Vercel's UI makes "" easy to save).
//   - Optional integrations are all-or-nothing where they come in pairs
//     (Upstash URL + token).
//   - Nothing here is NEXT_PUBLIC_-only: the schema is server-side, and
//     public vars are validated too because the server reads them as well.

const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const required = (schema: z.ZodType) => z.preprocess(blankToUndefined, schema);
const optional = (schema: z.ZodType) =>
  z.preprocess(blankToUndefined, schema.optional());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const envSchema = z
  .object({
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: required(z.url("must be a URL")),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: required(z.string("is required").min(1)),
    SUPABASE_SERVICE_ROLE_KEY: required(z.string("is required").min(1)),

    // Site origin for OAuth / email redirect links.
    NEXT_PUBLIC_SITE_URL: required(z.url("must be a URL")),

    // TMDB v4 read token (server-only).
    TMDB_ACCESS_TOKEN: required(z.string("is required").min(1)),

    // Shared rate-limit store. Unset → in-memory fallback (see rate-limit.ts).
    UPSTASH_REDIS_REST_URL: optional(z.url("must be a URL")),
    UPSTASH_REDIS_REST_TOKEN: optional(z.string().min(1)),

    // Comma-separated auth user ids allowed into /admin.
    ADMIN_USER_IDS: optional(
      z
        .string()
        .refine(
          (v) => v.split(",").every((id) => UUID.test(id.trim())),
          "must be a comma-separated list of user UUIDs",
        ),
    ),

    // Error monitoring webhook. Unset → reportError() is a no-op.
    ERROR_WEBHOOK_URL: optional(z.url("must be a URL")),
  })
  .superRefine((env, ctx) => {
    const hasUrl = !!env.UPSTASH_REDIS_REST_URL;
    const hasToken = !!env.UPSTASH_REDIS_REST_TOKEN;
    if (hasUrl !== hasToken) {
      ctx.addIssue({
        code: "custom",
        path: [hasUrl ? "UPSTASH_REDIS_REST_TOKEN" : "UPSTASH_REDIS_REST_URL"],
        message: "must be set together with its pair (URL + token)",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export type EnvResult =
  | { ok: true; env: Env; warnings: string[] }
  | { ok: false; errors: string[] };

export function validateEnv(
  source: Record<string, string | undefined> = process.env,
): EnvResult {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(env)"} ${issue.message}`,
      ),
    };
  }

  // Not fatal, but worth shouting about: in production the in-memory limiter
  // is per-instance, so limits are only advisory without Upstash.
  const warnings: string[] = [];
  if (source.NODE_ENV === "production" && !parsed.data.UPSTASH_REDIS_REST_URL) {
    warnings.push(
      "UPSTASH_REDIS_REST_URL is unset — rate limits fall back to per-instance memory.",
    );
  }

  return { ok: true, env: parsed.data, warnings };
}

// Called from instrumentation.ts at server boot. Throws so the process
// refuses to serve with a broken configuration.
export function assertEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const result = validateEnv(source);
  if (!result.ok) {
    throw new Error(
      `Invalid environment configuration:\n${result.errors
        .map((e) => `  - ${e}`)
        .join("\n")}\nSee .env.local.example.`,
    );
  }
  for (const w of result.warnings) console.warn(`[env] ${w}`);
  return result.env;
}

// Parsed admin ids. Reads process.env lazily so tests and callers don't
// depend on boot order; validation already ran at startup.
export function adminUserIds(
  source: Record<string, string | undefined> = process.env,
): Set<string> {
  const raw = source.ADMIN_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim().toLowerCase())
      .filter((id) => UUID.test(id)),
  );
}
