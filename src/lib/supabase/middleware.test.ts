import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { config } from "@/middleware";
import { hasAuthCookie, isProtected, updateSession } from "./middleware";

// The middleware now runs on every page route, so what matters is how much
// work each kind of request costs. These tests count Supabase calls per
// request shape: anonymous traffic must cost nothing, signed-in public
// traffic must never take the verified (network) path, and protected paths
// must keep their redirect.

const auth = {
  getSession: vi.fn(),
  getUser: vi.fn(),
};
// Typed with a rest param so mock.calls[0][2] (the cookie adapter) is
// reachable in the rotation test below.
const createServerClient = vi.fn((...args: unknown[]) => {
  void args;
  return { auth };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...args),
}));

function req(path: string, cookies: Record<string, string> = {}) {
  const r = new NextRequest(new URL(path, "https://perspective.test"));
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return r;
}

const SESSION = { "sb-abcd-auth-token": "base64-session" };

beforeEach(() => {
  vi.clearAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
});

describe("hasAuthCookie", () => {
  it("recognises whole and chunked session cookies", () => {
    expect(hasAuthCookie(req("/", { "sb-abcd-auth-token": "x" }))).toBe(true);
    expect(hasAuthCookie(req("/", { "sb-abcd-auth-token.0": "x" }))).toBe(true);
  });

  it("ignores the PKCE verifier and unrelated cookies", () => {
    expect(hasAuthCookie(req("/", { "sb-abcd-auth-token-code-verifier": "x" }))).toBe(false);
    expect(hasAuthCookie(req("/", { theme: "dark" }))).toBe(false);
  });
});

describe("updateSession", () => {
  it("anonymous public request: no client, no network", async () => {
    const res = await updateSession(req("/film/550"));
    expect(createServerClient).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("anonymous protected request: redirects to login without a network call", async () => {
    const res = await updateSession(req("/write/new?film=550"));
    expect(createServerClient).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://perspective.test/login?next=%2Fwrite%2Fnew%3Ffilm%3D550",
    );
  });

  it("signed-in public request: refreshes via getSession, never getUser", async () => {
    await updateSession(req("/perspective/abc", SESSION));
    expect(auth.getSession).toHaveBeenCalledTimes(1);
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("persists rotated cookies on public routes", async () => {
    auth.getSession.mockImplementation(async () => {
      const opts = createServerClient.mock.calls[0][2] as {
        cookies: { setAll: (c: Array<{ name: string; value: string; options: object }>) => void };
      };
      opts.cookies.setAll([
        { name: "sb-abcd-auth-token", value: "rotated", options: { path: "/" } },
      ]);
      return { data: { session: {} }, error: null };
    });
    const res = await updateSession(req("/alice", SESSION));
    expect(res.cookies.get("sb-abcd-auth-token")?.value).toBe("rotated");
  });

  it("signed-in protected request: verifies with getUser and lets a user through", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const res = await updateSession(req("/settings", SESSION));
    expect(auth.getUser).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it("stale cookie on a protected path still redirects", async () => {
    const res = await updateSession(req("/onboarding", SESSION));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?next=%2Fonboarding");
  });
});

describe("isProtected", () => {
  it("matches the prefixes and their children only", () => {
    expect(isProtected("/write")).toBe(true);
    expect(isProtected("/write/abc")).toBe(true);
    expect(isProtected("/settings")).toBe(true);
    expect(isProtected("/writers")).toBe(false);
    expect(isProtected("/")).toBe(false);
  });
});

describe("middleware matcher", () => {
  // Next compiles the matcher with path-to-regexp; a single regex group
  // after the leading slash behaves like this anchored RegExp.
  const pattern = new RegExp(`^${config.matcher[0]}$`);

  it.each([
    "/",
    "/home",
    "/alice",
    "/perspective/0b3f2a8e-5a1c-4c9e-9f0a-1d2e3f4a5b6c",
    "/film/550",
    "/lens/grief",
    "/write/new",
    "/settings",
    "/login",
    "/auth/callback",
  ])("runs on page route %s", (path) => {
    expect(pattern.test(path)).toBe(true);
  });

  it.each([
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/api/film-search",
    "/api/people-search",
    "/logo.svg",
    "/og/default.png",
    "/fonts/serif.woff2",
  ])("skips %s", (path) => {
    expect(pattern.test(path)).toBe(false);
  });
});
