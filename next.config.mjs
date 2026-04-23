/** @type {import('next').NextConfig} */
const nextConfig = {
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
