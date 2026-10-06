import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkMemoryRateLimit,
  checkRateLimit,
  checkUpstashRateLimit,
  hashKey,
  rateLimitMessage,
  __resetRateLimits,
} from "./rate-limit";

afterEach(() => {
  __resetRateLimits();
  vi.useRealTimers();
});

describe("checkMemoryRateLimit (fallback store)", () => {
  it("allows up to `max` requests in a window", () => {
    for (let i = 0; i < 5; i++) {
      const r = checkMemoryRateLimit("k", { max: 5, windowMs: 1000 });
      expect(r.ok).toBe(true);
    }
  });

  it("rejects the (max+1)-th request inside the window", () => {
    for (let i = 0; i < 5; i++) {
      checkMemoryRateLimit("k", { max: 5, windowMs: 1000 });
    }
    const r = checkMemoryRateLimit("k", { max: 5, windowMs: 1000 });
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.resetIn).toBeGreaterThan(0);
    expect(r.resetIn).toBeLessThanOrEqual(1000);
  });

  it("releases capacity after the window passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    for (let i = 0; i < 5; i++) {
      checkMemoryRateLimit("k", { max: 5, windowMs: 1000 });
    }
    expect(
      checkMemoryRateLimit("k", { max: 5, windowMs: 1000 }).ok,
    ).toBe(false);

    // Step past the window — old entries fall out.
    vi.setSystemTime(new Date("2026-01-01T00:00:01.500Z"));
    expect(
      checkMemoryRateLimit("k", { max: 5, windowMs: 1000 }).ok,
    ).toBe(true);
  });

  it("isolates buckets by key", () => {
    for (let i = 0; i < 5; i++) {
      checkMemoryRateLimit("user-a", { max: 5, windowMs: 1000 });
    }
    expect(
      checkMemoryRateLimit("user-a", { max: 5, windowMs: 1000 }).ok,
    ).toBe(false);
    // Different key — fresh budget.
    expect(
      checkMemoryRateLimit("user-b", { max: 5, windowMs: 1000 }).ok,
    ).toBe(true);
  });

  it("reports decreasing `remaining` as the bucket fills", () => {
    expect(
      checkMemoryRateLimit("k", { max: 3, windowMs: 1000 }).remaining,
    ).toBe(2);
    expect(
      checkMemoryRateLimit("k", { max: 3, windowMs: 1000 }).remaining,
    ).toBe(1);
    expect(
      checkMemoryRateLimit("k", { max: 3, windowMs: 1000 }).remaining,
    ).toBe(0);
  });
});

// A tiny in-process stand-in for Upstash's /pipeline endpoint. It implements
// exactly the three commands the limiter sends, with real expiry semantics,
// so these tests exercise the request shape and the reply parsing.
function fakeUpstash() {
  const store = new Map<string, { n: number; expiresAt: number | null }>();
  const requests: unknown[] = [];
  const impl = (async (_url: string, init: RequestInit) => {
    const cmds = JSON.parse(String(init.body)) as string[][];
    requests.push({ url: _url, auth: (init.headers as Record<string, string>).Authorization, cmds });
    const now = Date.now();
    const out = cmds.map(([cmd, key, arg, flag]) => {
      let entry = store.get(key);
      if (entry?.expiresAt && entry.expiresAt <= now) {
        store.delete(key);
        entry = undefined;
      }
      if (cmd === "INCR") {
        const next = { n: (entry?.n ?? 0) + 1, expiresAt: entry?.expiresAt ?? null };
        store.set(key, next);
        return { result: next.n };
      }
      if (cmd === "PEXPIRE") {
        if (!entry || (flag === "NX" && entry.expiresAt)) return { result: 0 };
        entry.expiresAt = now + Number(arg);
        return { result: 1 };
      }
      if (cmd === "PTTL") {
        if (!entry) return { result: -2 };
        return { result: entry.expiresAt ? entry.expiresAt - now : -1 };
      }
      return { error: `unknown command ${cmd}` };
    });
    return new Response(JSON.stringify(out), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, requests };
}

describe("checkUpstashRateLimit (shared store)", () => {
  const OPTS = { max: 3, windowMs: 1000 };

  it("sends INCR + PEXPIRE NX + PTTL as one authenticated pipeline", async () => {
    const fake = fakeUpstash();
    await checkUpstashRateLimit("https://x.upstash.io/", "tok", "login:1.2.3.4", OPTS, fake.impl);
    const key = `rl:${await hashKey("login:1.2.3.4")}`;
    expect(fake.requests[0]).toEqual({
      url: "https://x.upstash.io/pipeline",
      auth: "Bearer tok",
      cmds: [
        ["INCR", key],
        ["PEXPIRE", key, "1000", "NX"],
        ["PTTL", key],
      ],
    });
  });

  it("never sends personal data in keys (emails / IPs are hashed)", async () => {
    const fake = fakeUpstash();
    await checkUpstashRateLimit("https://x", "t", "login:email:alice@example.com", OPTS, fake.impl);
    const sent = JSON.stringify(fake.requests);
    expect(sent).not.toContain("alice");
    expect(sent).toMatch(/rl:[0-9a-f]{64}/);
  });

  it("allows up to max, then rejects with the remaining TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const fake = fakeUpstash();
    const hit = () => checkUpstashRateLimit("https://x", "t", "k", OPTS, fake.impl);

    expect((await hit()).remaining).toBe(2);
    expect((await hit()).remaining).toBe(1);
    expect((await hit()).remaining).toBe(0);

    vi.setSystemTime(new Date("2026-01-01T00:00:00.400Z"));
    const blocked = await hit();
    expect(blocked.ok).toBe(false);
    expect(blocked.resetIn).toBe(600);

    // Window anchored at the first hit: it frees up 1000ms after it, not
    // 1000ms after the latest (NX keeps the expiry from sliding).
    vi.setSystemTime(new Date("2026-01-01T00:00:01.001Z"));
    expect((await hit()).ok).toBe(true);
  });

  it("throws on HTTP errors and command errors (caller falls back)", async () => {
    const http500 = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(checkUpstashRateLimit("https://x", "t", "k", OPTS, http500)).rejects.toThrow(/500/);

    const cmdErr = (async () =>
      new Response(JSON.stringify([{ error: "WRONGPASS" }, {}, {}]), { status: 200 })) as unknown as typeof fetch;
    await expect(checkUpstashRateLimit("https://x", "t", "k", OPTS, cmdErr)).rejects.toThrow(/WRONGPASS/);
  });
});

describe("checkRateLimit (store selection)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses memory when Upstash isn't configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (let i = 0; i < 2; i++) await checkRateLimit("sel", { max: 2, windowMs: 1000 });
    expect((await checkRateLimit("sel", { max: 2, windowMs: 1000 })).ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses Upstash when configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://x.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    const fake = fakeUpstash();
    vi.stubGlobal("fetch", fake.impl);
    await checkRateLimit("sel2", { max: 2, windowMs: 1000 });
    expect(fake.requests).toHaveLength(1);
  });

  it("falls back to memory when Upstash fails, instead of failing the request", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://x.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await checkRateLimit("sel3", { max: 1, windowMs: 1000 });
    expect(r.ok).toBe(true);
    // Still limited, just per-instance.
    expect((await checkRateLimit("sel3", { max: 1, windowMs: 1000 })).ok).toBe(false);
  });
});

describe("rateLimitMessage", () => {
  it("rounds up to whole seconds and never says 0s", () => {
    expect(rateLimitMessage({ ok: false, remaining: 0, resetIn: 1200 })).toBe(
      "Slow down — try again in 2s.",
    );
    expect(rateLimitMessage({ ok: false, remaining: 0, resetIn: 0 })).toBe(
      "Slow down — try again in 1s.",
    );
  });
});
