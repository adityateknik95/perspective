import { describe, expect, it } from "vitest";
import { adminUserIds, assertEnv, validateEnv } from "./env";

const VALID = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  NEXT_PUBLIC_SITE_URL: "https://perspective.app",
  TMDB_ACCESS_TOKEN: "eyJ.tmdb",
};

const A = "0b3f2a8e-5a1c-4c9e-9f0a-1d2e3f4a5b6c";
const B = "1c4e3b9f-6b2d-4d0f-8a1b-2e3f4a5b6c7d";

describe("validateEnv", () => {
  it("accepts the minimum required set", () => {
    expect(validateEnv(VALID).ok).toBe(true);
  });

  it("lists every missing required variable at once", () => {
    const result = validateEnv({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    for (const key of Object.keys(VALID)) {
      expect(result.errors.some((e) => e.startsWith(key))).toBe(true);
    }
  });

  it("treats empty strings as unset", () => {
    const result = validateEnv({ ...VALID, TMDB_ACCESS_TOKEN: "  " });
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed URL", () => {
    const result = validateEnv({ ...VALID, NEXT_PUBLIC_SUPABASE_URL: "abcd.supabase" });
    expect(result.ok).toBe(false);
  });

  it("requires the Upstash URL and token together", () => {
    expect(validateEnv({ ...VALID, UPSTASH_REDIS_REST_URL: "https://x.upstash.io" }).ok).toBe(false);
    expect(validateEnv({ ...VALID, UPSTASH_REDIS_REST_TOKEN: "t" }).ok).toBe(false);
    expect(
      validateEnv({ ...VALID, UPSTASH_REDIS_REST_URL: "https://x.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" }).ok,
    ).toBe(true);
  });

  it("validates ADMIN_USER_IDS as UUIDs", () => {
    expect(validateEnv({ ...VALID, ADMIN_USER_IDS: `${A}, ${B}` }).ok).toBe(true);
    expect(validateEnv({ ...VALID, ADMIN_USER_IDS: `${A},alice` }).ok).toBe(false);
  });

  it("warns (but passes) when production has no shared rate-limit store", () => {
    const result = validateEnv({ ...VALID, NODE_ENV: "production" });
    expect(result.ok && result.warnings.length).toBe(1);
  });
});

describe("assertEnv", () => {
  it("throws with every problem listed", () => {
    expect(() => assertEnv({ ...VALID, SUPABASE_SERVICE_ROLE_KEY: "" })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });
});

describe("adminUserIds", () => {
  it("parses, trims and lowercases", () => {
    expect(adminUserIds({ ADMIN_USER_IDS: ` ${A.toUpperCase()} ,${B}` })).toEqual(new Set([A, B]));
  });

  it("is empty when unset", () => {
    expect(adminUserIds({}).size).toBe(0);
  });
});
