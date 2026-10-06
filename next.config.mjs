import { securityHeaders } from "./security-headers.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enables src/instrumentation.ts, which validates env vars at server
    // boot (src/lib/env.ts). Stable in Next 15; opt-in on 14.
    instrumentationHook: true,
  },
  // CSP + hardening headers on every route; see security-headers.mjs for
  // what each directive allows and why.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          isDev: process.env.NODE_ENV !== "production",
        }),
      },
    ];
  },
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  images: {
    // Avatars are served from the Supabase Storage CDN. Project-specific
    // hostnames look like <project-ref>.supabase.co.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // TMDB image CDN — posters and backdrops.
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
};

export default nextConfig;
