import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: () => ({}) }));
import { robotsRules, siteUrl, sitemapEntries } from "./seo";

function fakeClient(total: number) {
  const calls: Array<{ filters: Array<[string, unknown]>; range: [number, number] }> = [];
  const rows = Array.from({ length: total }, (_, i) => ({
    id: `p${i}`,
    updated_at: "2026-01-02T00:00:00Z",
    published_at: "2026-01-01T00:00:00Z",
  }));
  const client = {
    from: () => {
      const call = { filters: [] as Array<[string, unknown]>, range: [0, 0] as [number, number] };
      calls.push(call);
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => (call.filters.push([`eq:${c}`, v]), q),
        is: (c: string, v: unknown) => (call.filters.push([`is:${c}`, v]), q),
        order: () => q,
        range: async (a: number, b: number) => {
          call.range = [a, b];
          return { data: rows.slice(a, b + 1), error: null };
        },
      };
      return q;
    },
  };
  return { client, calls };
}

describe("sitemapEntries", () => {
  it("lists the home page plus only public, published, unhidden pieces", async () => {
    const { client, calls } = fakeClient(2);
    const entries = await sitemapEntries(client as never, "https://perspective.app");
    expect(entries.map((e) => e.url)).toEqual([
      "https://perspective.app/",
      "https://perspective.app/perspective/p0",
      "https://perspective.app/perspective/p1",
    ]);
    expect(calls[0].filters).toEqual([
      ["eq:is_draft", false],
      ["eq:is_private", false],
      ["is:hidden_at", null],
    ]);
    expect(entries[1].lastModified).toBe("2026-01-02T00:00:00Z");
  });

  it("pages through PostgREST's 1,000-row limit", async () => {
    const { client, calls } = fakeClient(2500);
    const entries = await sitemapEntries(client as never, "https://x");
    expect(entries).toHaveLength(2501);
    expect(calls.map((c) => c.range)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });
});

describe("robotsRules", () => {
  it("allows crawling in production, keeps private surfaces out, and points at the sitemap", () => {
    const r = robotsRules({ NEXT_PUBLIC_SITE_URL: "https://perspective.app/", VERCEL_ENV: "production" });
    expect(r.sitemap).toBe("https://perspective.app/sitemap.xml");
    const rules = r.rules as { allow: string; disallow: string[] };
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toEqual(expect.arrayContaining(["/admin", "/settings", "/write", "/api/"]));
  });

  it("blocks everything on Vercel previews", () => {
    expect(robotsRules({ VERCEL_ENV: "preview" })).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});

describe("siteUrl", () => {
  it("strips a trailing slash", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://a.b/" })).toBe("https://a.b");
  });
});
