import { defineConfig, devices } from "@playwright/test";

// End-to-end tests for the core flow (e2e/). They drive a real browser
// against a real build talking to a real Supabase project — a disposable
// one with migrations applied, never production: the tests create and
// delete users.
//
// Required env (see README → End-to-end tests):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
//   SUPABASE_SERVICE_ROLE_KEY — the test project
// Optional:
//   E2E_BASE_URL — test an already-running app instead of starting one
//
// TMDB is not needed: the flow seeds its film row directly, and the film
// page / draft creation read cached rows without calling TMDB.

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  // The flow is one story told in order (writer → reader → writer).
  fullyParallel: false,
  workers: 1,
  // A failure is a bug to fix, not something to retry past.
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Serve the production build (run `pnpm build` first). Skipped when
  // E2E_BASE_URL points at a server that's already up.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm start -p 3100",
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
          NEXT_PUBLIC_SITE_URL: baseURL,
          // Env validation requires it at boot; the flow never calls TMDB.
          TMDB_ACCESS_TOKEN: process.env.TMDB_ACCESS_TOKEN || "e2e-unused",
        },
      },
});
