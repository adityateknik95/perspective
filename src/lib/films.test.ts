import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimits } from "@/lib/rate-limit";

// Next bundles a React build with cache(); plain Node's react 18 doesn't
// export it. Identity is the right stand-in: we're testing one call at a time.
vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

const getFilm = vi.fn();
vi.mock("@/lib/tmdb/client", () => ({ getFilm: (id: number) => getFilm(id) }));

let cachedRow: Record<string, unknown> | null = null;
const upsert = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: cachedRow, error: null }),
        }),
      }),
      upsert: (row: Record<string, unknown>) => {
        upsert(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: "f-new", ...row }, error: null }),
          }),
        };
      },
    }),
  }),
}));

import { getOrCreateFilmByTmdbId } from "./films";

const DETAIL = {
  tmdbId: 550,
  title: "Fight Club",
  year: 1999,
  director: "David Fincher",
  runtimeMinutes: 139,
  overview: "…",
  posterPath: "/p.jpg",
  backdropPath: null,
  originalLanguage: "en",
};

beforeEach(() => {
  cachedRow = null;
  getFilm.mockReset().mockResolvedValue(DETAIL);
  upsert.mockReset();
});
afterEach(() => __resetRateLimits());

describe("getOrCreateFilmByTmdbId", () => {
  it("returns a cached row without calling TMDB", async () => {
    cachedRow = { id: "f1", tmdb_id: 550, title: "Fight Club" };
    const res = await getOrCreateFilmByTmdbId(550, "ip:1");
    expect(res).toEqual({ ok: true, film: cachedRow });
    expect(getFilm).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("cache hits don't spend the insert budget", async () => {
    cachedRow = { id: "f1", tmdb_id: 550 };
    for (let i = 0; i < 100; i++) await getOrCreateFilmByTmdbId(550, "ip:1");
    cachedRow = null;
    expect((await getOrCreateFilmByTmdbId(551, "ip:1")).ok).toBe(true);
  });

  it("on a miss, fetches TMDB once and inserts", async () => {
    const res = await getOrCreateFilmByTmdbId(550, "ip:1");
    expect(res.ok).toBe(true);
    expect(getFilm).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ tmdb_id: 550, title: "Fight Club" }));
  });

  it("rate limits new films per client, without calling TMDB", async () => {
    for (let i = 0; i < 30; i++) await getOrCreateFilmByTmdbId(1000 + i, "ip:walker");
    getFilm.mockClear();
    expect(await getOrCreateFilmByTmdbId(2000, "ip:walker")).toEqual({
      ok: false,
      reason: "rate_limited",
    });
    expect(getFilm).not.toHaveBeenCalled();
    // A different visitor still gets through.
    expect((await getOrCreateFilmByTmdbId(2000, "ip:someone-else")).ok).toBe(true);
  });

  it("caps inserts globally across clients", async () => {
    for (let i = 0; i < 1000; i++) await getOrCreateFilmByTmdbId(10_000 + i, `ip:${i % 40}`);
    expect(await getOrCreateFilmByTmdbId(99_999, "ip:fresh")).toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });

  it("maps an unknown TMDB id to not_found", async () => {
    getFilm.mockRejectedValue(new Error("TMDB /movie/9 failed: 404"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getOrCreateFilmByTmdbId(9, "ip:1")).toEqual({ ok: false, reason: "not_found" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects invalid ids before touching anything", async () => {
    expect(await getOrCreateFilmByTmdbId(-1, "ip:1")).toEqual({ ok: false, reason: "not_found" });
    expect(await getOrCreateFilmByTmdbId(1.5, "ip:1")).toEqual({ ok: false, reason: "not_found" });
  });
});
