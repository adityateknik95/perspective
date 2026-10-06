// Rate limiter with a shared store (Upstash Redis over REST) and an
// in-memory fallback.
//
// WHY A SHARED STORE: the in-memory limiter is per-process. On Vercel each
// warm lambda instance has its own buckets, so the effective limit was
// roughly N * configured-limit, and every cold start reset it. For anything
// that protects a cost (TMDB quota, Supabase auth emails) or an account
// (login guessing), the count has to live outside the process.
//
// STORE SELECTION (per call):
//   - UPSTASH_REDIS_REST_URL + _TOKEN set → Upstash. Fixed-window counter:
//       INCR key; PEXPIRE key windowMs NX; PTTL key
//     sent as one pipeline, so concurrent requests from different instances
//     can't both see the same count. Fixed windows allow up to 2x `max` in a
//     burst straddling a boundary; that's acceptable for abuse braking and
//     costs one round trip instead of a sorted-set sliding window's three.
//   - Unset → in-memory rolling window (the original implementation). Fine
//     for local dev and tests; env validation warns about it in production.
//   - Upstash errors or is slow (> UPSTASH_TIMEOUT_MS) → fall back to memory
//     for that call. A limiter outage must not take down sign-in or writing;
//     degrading to per-instance limits is the lesser failure.
//
// No dependency: Upstash's REST API is a POST of JSON command arrays, so
// fetch is enough (see the Phase 2 discussion: @upstash/ratelimit was the
// alternative).
//
// Usage:
//
//   import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";
//   const limit = await checkRateLimit(`reaction:${userId}`, { max: 30, windowMs: 60_000 });
//   if (!limit.ok) return { ok: false, error: rateLimitMessage(limit) };

export type RateLimitOptions = {
  max: number;       // requests per window
  windowMs: number;  // window size in ms
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetIn: number; // ms until capacity frees up (0 when ok)
};

export function rateLimitMessage(result: RateLimitResult): string {
  return `Slow down — try again in ${Math.max(1, Math.ceil(result.resetIn / 1000))}s.`;
}

export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return checkMemoryRateLimit(key, opts);

  try {
    return await checkUpstashRateLimit(url, token, key, opts);
  } catch (err) {
    console.warn("rate-limit: Upstash unavailable, using memory fallback:", err);
    return checkMemoryRateLimit(key, opts);
  }
}

// ---------------------------------------------------------------------------
// Upstash (shared)
// ---------------------------------------------------------------------------

const UPSTASH_TIMEOUT_MS = 800;
const KEY_PREFIX = "rl:";

type PipelineReply = Array<{ result?: unknown; error?: string }>;

export async function checkUpstashRateLimit(
  url: string,
  token: string,
  key: string,
  { max, windowMs }: RateLimitOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<RateLimitResult> {
  const redisKey = `${KEY_PREFIX}${key}`;
  const res = await fetchImpl(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      // NX: only set the expiry when the key is new, so the window is
      // anchored at the first request and doesn't slide on every hit.
      ["PEXPIRE", redisKey, String(windowMs), "NX"],
      ["PTTL", redisKey],
    ]),
    signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);

  const reply = (await res.json()) as PipelineReply;
  const failed = reply.find((r) => r.error);
  if (failed) throw new Error(`Upstash: ${failed.error}`);

  const count = Number(reply[0]?.result);
  const pttl = Number(reply[2]?.result);
  if (!Number.isFinite(count)) throw new Error("Upstash: malformed INCR reply");

  // PTTL is -1 if the key somehow has no expiry (e.g. PEXPIRE lost a race
  // with an eviction); treat the full window as remaining.
  const resetIn = pttl > 0 ? pttl : windowMs;

  if (count > max) return { ok: false, remaining: 0, resetIn };
  return { ok: true, remaining: max - count, resetIn: 0 };
}

// ---------------------------------------------------------------------------
// In-memory (fallback) — a rolling window of timestamps per key.
//
//   - Per-process and reset on cold start (see top of file).
//   - Memory is bounded by trimming each touched bucket to the window and a
//     passive sweep over all buckets every GC_INTERVAL ms.
// ---------------------------------------------------------------------------

const buckets = new Map<string, number[]>();
const GC_INTERVAL = 5 * 60_000; // 5 min
let lastGcAt = Date.now();

export function checkMemoryRateLimit(
  key: string,
  { max, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();

  // Periodic sweep of stale buckets. Cheap — O(buckets) but only runs
  // every few minutes.
  if (now - lastGcAt > GC_INTERVAL) {
    buckets.forEach((arr, k) => {
      const fresh = arr.filter((t: number) => now - t < windowMs);
      if (fresh.length === 0) buckets.delete(k);
      else buckets.set(k, fresh);
    });
    lastGcAt = now;
  }

  const fresh = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (fresh.length >= max) {
    const oldest = fresh[0];
    return {
      ok: false,
      remaining: 0,
      resetIn: Math.max(0, windowMs - (now - oldest)),
    };
  }

  fresh.push(now);
  buckets.set(key, fresh);

  return {
    ok: true,
    remaining: max - fresh.length,
    resetIn: 0,
  };
}

// Test-only escape hatch. Production code should never call this.
export function __resetRateLimits() {
  buckets.clear();
  lastGcAt = Date.now();
}
