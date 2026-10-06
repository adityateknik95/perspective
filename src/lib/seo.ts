import "server-only";
import type { MetadataRoute } from "next";
import { createAnonClient } from "@/lib/supabase/anon";

// Sitemap + robots logic, kept out of the route files so it's testable.

// One sitemap file may hold 50,000 URLs. PostgREST returns at most 1,000
// rows per request by default, hence the paging.
const SITEMAP_MAX = 50_000;
const PAGE = 1000;

export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// Only public, published pieces. Read as anon, so RLS already excludes
// drafts, private pieces, hidden pieces and pieces by private profiles —
// the explicit filters restate the rule rather than rely on it silently.
export async function sitemapEntries(
  client = createAnonClient(),
  base = siteUrl(),
): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [{ url: `${base}/`, changeFrequency: "daily", priority: 1 }];

  for (let from = 0; from < SITEMAP_MAX; from += PAGE) {
    const { data, error } = await client
      .from("perspectives")
      .select("id, updated_at, published_at")
      .eq("is_draft", false)
      .eq("is_private", false)
      .is("hidden_at", null)
      .order("published_at", { ascending: false })
      .range(from, Math.min(from + PAGE, SITEMAP_MAX) - 1);
    if (error) throw error;

    for (const row of data ?? []) {
      entries.push({
        url: `${base}/perspective/${row.id}`,
        lastModified: row.updated_at ?? row.published_at ?? undefined,
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return entries;
}

// Paths with nothing worth indexing, or that only make sense signed in.
export const DISALLOWED_PATHS = [
  "/admin",
  "/api/",
  "/auth/",
  "/onboarding",
  "/settings",
  "/write",
  "/notifications",
  "/home",
];

export function robotsRules(env: Record<string, string | undefined> = process.env): MetadataRoute.Robots {
  // Vercel preview deployments must never be indexed: they share content
  // with production and would compete with it in search.
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },
    sitemap: `${siteUrl(env)}/sitemap.xml`,
  };
}
