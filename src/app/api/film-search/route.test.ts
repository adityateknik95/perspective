import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { __resetRateLimits } from "@/lib/rate-limit";
import { GET } from "./route";

vi.mock("@/lib/tmdb/client", () => ({
  searchFilms: vi.fn(async () => []),
}));

const search = (ip: string) =>
  GET(
    new NextRequest("https://perspective.test/api/film-search?q=heat", {
      headers: { "x-forwarded-for": ip },
    }),
  );

afterEach(() => __resetRateLimits());

describe("GET /api/film-search rate limit", () => {
  it("returns 429 with Retry-After after 60 searches a minute from one IP", async () => {
    for (let i = 0; i < 60; i++) expect((await search("203.0.113.1")).status).toBe(200);
    const blocked = await search("203.0.113.1");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("keys by IP, so one client doesn't block another", async () => {
    for (let i = 0; i < 61; i++) await search("203.0.113.1");
    expect((await search("203.0.113.2")).status).toBe(200);
  });
});
