import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Only run middleware on routes that require authentication.
  // This avoids any Supabase network call on public pages and prevents
  // MIDDLEWARE_INVOCATION_TIMEOUT on Vercel.
  matcher: ["/onboarding/:path*", "/settings/:path*", "/write/:path*"],
};
