import { defineConfig } from "vitest/config";
import path from "node:path";

// Node-environment tests for pure functions in src/lib. We're not testing
// React components here — that's a different runtime (jsdom) and a heavier
// setup; start with what's actually breakage-prone (sanitize allowlist,
// optimistic math, rate limiter math).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` throws on import outside a React Server Component.
      // We're testing pure helpers that happen to live in server modules —
      // the no-op shim lets the import resolve cleanly.
      "server-only": path.resolve(__dirname, "test/shims/server-only.ts"),
    },
  },
});
