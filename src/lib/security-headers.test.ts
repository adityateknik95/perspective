import { describe, expect, it } from "vitest";
// Lives at the repo root so next.config.mjs can import it without a build step.
import { contentSecurityPolicy, securityHeaders } from "../../security-headers.mjs";

const SUPABASE = "https://abcd.supabase.co";

function directives(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp.split(";").map((d) => {
      const [name, ...values] = d.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

describe("contentSecurityPolicy (production)", () => {
  const d = directives(contentSecurityPolicy({ supabaseUrl: `${SUPABASE}/`, isDev: false }));

  it("only loads scripts from our origin, never eval", () => {
    expect(d["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it("allows TMDB posters and Supabase avatars, nothing else remote", () => {
    expect(d["img-src"]).toEqual(["'self'", "data:", "blob:", "https://image.tmdb.org", SUPABASE]);
  });

  it("lets the browser client talk to Supabase (https + wss) and nowhere else", () => {
    expect(d["connect-src"]).toEqual(["'self'", SUPABASE, "wss://abcd.supabase.co"]);
  });

  it("forbids framing, plugins, base hijacking and off-site form posts", () => {
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
    expect(d["form-action"]).toEqual(["'self'"]);
    expect(d["upgrade-insecure-requests"]).toEqual([]);
  });
});

describe("contentSecurityPolicy (development)", () => {
  const csp = contentSecurityPolicy({ supabaseUrl: "http://127.0.0.1:54321", isDev: true });

  it("adds unsafe-eval for React Refresh and allows a local http Supabase", () => {
    expect(directives(csp)["script-src"]).toContain("'unsafe-eval'");
    expect(directives(csp)["connect-src"]).toContain("ws://127.0.0.1:54321");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("survives a missing or malformed Supabase URL", () => {
    expect(contentSecurityPolicy({ supabaseUrl: undefined })).toContain("connect-src 'self'");
    expect(contentSecurityPolicy({ supabaseUrl: "not a url" })).toContain("connect-src 'self'");
  });
});

describe("securityHeaders", () => {
  it("sends HSTS only outside development", () => {
    const keys = (isDev: boolean) => securityHeaders({ supabaseUrl: SUPABASE, isDev }).map((h) => h.key);
    expect(keys(false)).toContain("Strict-Transport-Security");
    expect(keys(true)).not.toContain("Strict-Transport-Security");
  });

  it("always sets the baseline hardening headers", () => {
    const h = Object.fromEntries(securityHeaders({ supabaseUrl: SUPABASE }).map((x) => [x.key, x.value]));
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });
});
