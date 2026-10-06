// Next.js runs register() once when a server instance boots (not during
// `next build`). We use it to validate configuration before the first
// request, so a deploy with a missing variable fails loudly at startup
// instead of on some reader's page view.
export async function register() {
  // The import must stay INSIDE this block (not after an early return):
  // Next inlines NEXT_RUNTIME per bundle, and only this shape lets it drop
  // zod + the env schema from the edge (middleware) bundle entirely —
  // the early-return form shipped ~100 kB of dead code to the edge.
  // Middleware only reads the two public Supabase vars, which the Node
  // server validates too; one check per boot is enough.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnv } = await import("@/lib/env");
    try {
      assertEnv();
    } catch (err) {
      // Throwing alone isn't enough: Next logs "Failed to prepare server"
      // and then keeps the process alive answering every request with a
      // 500. Exit so `next start`, container health checks and Vercel's
      // function logs all fail at boot with the list of what's wrong.
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }
}
