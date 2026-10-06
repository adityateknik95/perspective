import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Every page route, so refreshed session cookies are saved wherever the
  // user happens to be when their access token expires. Skipped:
  //   _next/static, _next/image, favicon.ico, robots.txt, sitemap.xml —
  //     build output and crawler files, never session-bearing.
  //   api/ — route handlers can set cookies themselves, and keeping the
  //     TMDB / search proxies out of middleware keeps them fast.
  //   any path ending in a static asset extension (public/ files).
  // updateSession returns immediately for requests without an auth cookie,
  // so anonymous traffic pays nothing; see src/lib/supabase/middleware.ts.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|woff2?|ttf|otf|map)$).*)",
  ],
};
