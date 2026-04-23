import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

// Service-role Supabase client. Bypasses RLS. Only use for narrow,
// well-understood jobs (e.g. upserting TMDB film reference data, admin
// maintenance). Never expose to client components, never construct off the
// request path that might end up serialized.
//
// If you find yourself reaching for this client to paper over a missing RLS
// policy, stop and add the policy instead.
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is not set. Admin client requires both.",
    );
  }

  cached = createClient<Database>(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}
