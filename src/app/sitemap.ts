import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/seo";

// Rendered per request: crawlers fetch it rarely, it must reflect privacy
// changes promptly, and a build-time render would need a live database.
export const dynamic = "force-dynamic";

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries();
}
