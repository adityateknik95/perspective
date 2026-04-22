import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip Next internals, the auth callback (it manages its own cookies),
    // and any path with a file extension (images, fonts, manifests, etc.).
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\..*).*)",
  ],
};
