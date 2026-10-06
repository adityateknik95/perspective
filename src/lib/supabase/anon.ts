import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

// Cookie-less anon client: reads exactly what a signed-out visitor could.
// For public artefacts that must look the same to everyone and must never
// reflect the requester's session — share images, sitemap, robots. Using
// the cookie-based server client there would let an author's own session
// render a private piece into a cacheable image.
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createAnonClient() {
  if (cached) return cached;
  cached = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      // Next 14 caches GET fetches in route handlers indefinitely unless the
      // route reads cookies/headers — and this client deliberately doesn't.
      // Without no-store, the first answer for a piece was kept forever:
      // a piece later made private or hidden kept its old share card, and
      // the sitemap kept listing it. Callers cache at the HTTP layer with a
      // bounded TTL instead.
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    },
  );
  return cached;
}
