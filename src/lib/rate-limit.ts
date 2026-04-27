// In-memory rate limiter — a rolling window of timestamps per key.
//
// LIMITS OF THE LIMITER:
//   - Per-process. On Vercel each lambda instance has its own bucket, so
//     the effective limit is roughly N * configured-limit when N instances
//     are warm. That's acceptable for v1 as a coarse abuse brake — the
//     real defence against bursts at scale is Upstash / Redis. Swap this
//     module for @upstash/ratelimit when that day comes; the call site
//     contract (one boolean) doesn't change.
//   - Resets on cold start. Same caveat — fine for v1.
//   - Memory grows until the periodic GC fires. We cap entries by trimming
//     each touched bucket to entries inside the window, and run a passive
//     sweep over all buckets every GC_INTERVAL ms.
//
// Usage from a server action:
//
//   import { checkRateLimit } from "@/lib/rate-limit";
//   const limit = checkRateLimit(`reaction:${userId}`, { max: 30, windowMs: 60_000 });
//   if (!limit.ok) {
//     return { error: `Slow down — try again in ${Math.ceil(limit.resetIn / 1000)}s.` };
//   }

const buckets = new Map<string, number[]>();
const GC_INTERVAL = 5 * 60_000; // 5 min
let lastGcAt = Date.now();

export type RateLimitOptions = {
  max: number;       // requests per window
  windowMs: number;  // window size in ms
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetIn: number; // ms until the oldest entry falls out of the window
};

export function checkRateLimit(
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
