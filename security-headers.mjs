// Security headers for every response, applied from next.config.mjs.
// Kept in its own module so it's unit-tested (src/lib/security-headers.test.ts)
// and so next.config.mjs stays readable.
//
// What the CSP has to allow, and why:
//   script-src 'unsafe-inline'  Next.js 14 streams inline bootstrap scripts
//                               (self.__next_f.push) and the theme script
//                               runs inline before paint. Static headers
//                               can't carry a per-request nonce, so this is
//                               the price of setting CSP here rather than in
//                               middleware. It still blocks every external
//                               script origin, and with connect-src locked
//                               down an injected script has nowhere to send
//                               data except our own origin and Supabase.
//   script-src 'unsafe-eval'    Development only (React Refresh / webpack).
//   style-src 'unsafe-inline'   Tiptap/ProseMirror injects a <style> tag and
//                               framer-motion / r3f set inline styles.
//   img-src                     TMDB posters + Supabase Storage avatars;
//                               data:/blob: for the avatar preview and r3f.
//   connect-src                 Supabase REST/Auth from the browser client
//                               (and wss: for Realtime should it be used).
//   frame-ancestors 'none'      No embedding (clickjacking); X-Frame-Options
//                               says the same for older browsers.
//   form-action 'self'          Forms post only to us. Google OAuth starts
//                               with a JS redirect, which form-action
//                               doesn't govern.

/**
 * @param {{ supabaseUrl?: string, isDev?: boolean }} opts
 * @returns {string}
 */
export function contentSecurityPolicy({ supabaseUrl, isDev = false }) {
  const supabase = originOf(supabaseUrl);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : null;

  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://image.tmdb.org", ...(supabase ? [supabase] : [])],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(supabase ? [supabase, supabaseWs] : [])],
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };

  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/**
 * @param {{ supabaseUrl?: string, isDev?: boolean }} opts
 * @returns {Array<{ key: string, value: string }>}
 */
export function securityHeaders({ supabaseUrl, isDev = false }) {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy({ supabaseUrl, isDev }) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // HTTPS only outside development. Two years, subdomains included; no
    // `preload` — submitting to the preload list is a separate, hard-to-
    // reverse decision for whoever owns the domain.
    ...(isDev
      ? []
      : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
  ];
}

function originOf(url) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
