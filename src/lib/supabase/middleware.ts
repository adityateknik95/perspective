import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types";

// Paths that require an authenticated user. Unauthenticated visitors are
// redirected to /login?next=<originally-requested-url> so the auth flow can
// return them afterward. /[username] is handled at the page level because
// most profile views are public.
// /admin is also gated by ADMIN_USER_IDS at the page (404 for non-admins);
// listing it here just sends signed-out visitors to /login first.
const PROTECTED_PREFIXES = ["/onboarding", "/settings", "/write", "/admin"];

export function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// @supabase/ssr stores the session as `sb-<project-ref>-auth-token`, split
// into `.0`, `.1`, … chunks when it outgrows one cookie. The PKCE
// `-code-verifier` cookie also starts with `sb-` but isn't a session.
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

export function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => AUTH_COOKIE.test(name));
}

// Runs on every page route (see the matcher in src/middleware.ts). Its job:
//
//   1. Persist refreshed session cookies. Server Components can't set
//      cookies, so if the access token expires while a user browses public
//      pages, only middleware can write the rotated tokens back. Without it
//      the refresh token is spent but never saved, and the next request
//      signs the user out.
//   2. Redirect signed-out visitors away from protected paths.
//
// Cost control (the reason the matcher was once narrowed — Vercel's
// MIDDLEWARE_INVOCATION_TIMEOUT):
//   - No auth cookie → return immediately. Anonymous traffic, the bulk of
//     public page views, never constructs a client or touches the network.
//   - Public path with a cookie → getSession(). It reads the cookie and only
//     calls Supabase when the access token has expired (≈ once an hour per
//     user), writing the rotated tokens back via setAll. We don't trust the
//     returned user for anything here, so the unverified read is fine;
//     pages that need identity still call getUser() themselves.
//     getClaims() would be the verified option, but on projects still using
//     the legacy HS256 secret it falls back to getUser() — a network call on
//     every request, which is what timed out before.
//   - Protected path → getUser(), a verified round trip, because we make an
//     access decision on it. Same cost as before this change.
//
// We deliberately don't race the refresh against a timeout: refresh tokens
// are single-use, so abandoning one mid-flight would drop the rotated token
// and sign the user out — the bug this middleware exists to prevent.
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const protectedPath = isProtected(pathname);

  if (!hasAuthCookie(request)) {
    if (!protectedPath) return NextResponse.next({ request });
    return redirectToLogin(request, pathname + search);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  if (!protectedPath) {
    await supabase.auth.getSession();
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirectToLogin(request, pathname + search);

  return response;
}

function redirectToLogin(request: NextRequest, next: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(loginUrl);
}
