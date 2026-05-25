import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, __resetRateLimits } from "./rate-limit";

afterEach(() => {
  __resetRateLimits();
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows up to `max` requests in a window", () => {
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit("k", { max: 5, windowMs: 1000 });
      expect(r.ok).toBe(true);
    }
  });

  it("rejects the (max+1)-th request inside the window", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("k", { max: 5, windowMs: 1000 });
    }
    const r = checkRateLimit("k", { max: 5, windowMs: 1000 });
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.resetIn).toBeGreaterThan(0);
    expect(r.resetIn).toBeLessThanOrEqual(1000);
  });

  it("releases capacity after the window passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    for (let i = 0; i < 5; i++) {
      checkRateLimit("k", { max: 5, windowMs: 1000 });
    }
    expect(
      checkRateLimit("k", { max: 5, windowMs: 1000 }).ok,
    ).toBe(false);

    // Step past the window — old entries fall out.
    vi.setSystemTime(new Date("2026-01-01T00:00:01.500Z"));
    expect(
      checkRateLimit("k", { max: 5, windowMs: 1000 }).ok,
    ).toBe(true);
  });

  it("isolates buckets by key", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("user-a", { max: 5, windowMs: 1000 });
    }
    expect(
      checkRateLimit("user-a", { max: 5, windowMs: 1000 }).ok,
    ).toBe(false);
    // Different key — fresh budget.
    expect(
      checkRateLimit("user-b", { max: 5, windowMs: 1000 }).ok,
    ).toBe(true);
  });

  it("reports decreasing `remaining` as the bucket fills", () => {
    expect(
      checkRateLimit("k", { max: 3, windowMs: 1000 }).remaining,
    ).toBe(2);
    expect(
      checkRateLimit("k", { max: 3, windowMs: 1000 }).remaining,
    ).toBe(1);
    expect(
      checkRateLimit("k", { max: 3, windowMs: 1000 }).remaining,
    ).toBe(0);
  });
});
