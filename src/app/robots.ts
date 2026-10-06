import type { MetadataRoute } from "next";
import { robotsRules } from "@/lib/seo";

// Per request so VERCEL_ENV is read at runtime (preview vs production).
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return robotsRules();
}
