import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimits } from "@/lib/rate-limit";
import { loginAction } from "./actions";

let ip = "203.0.113.1";
const signInWithPassword = vi.fn(async () => ({
  data: { user: null },
  error: { message: "Invalid login credentials" },
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers({ "x-forwarded-for": ip }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));

function form(email: string) {
  const f = new FormData();
  f.set("email", email);
  f.set("password", "wrong-password");
  return f;
}

beforeEach(() => {
  ip = "203.0.113.1";
  signInWithPassword.mockClear();
});
afterEach(() => __resetRateLimits());

describe("loginAction rate limits", () => {
  it("stops one IP after 20 attempts across different accounts", async () => {
    for (let i = 0; i < 20; i++) await loginAction(form(`user${i}@example.com`));
    const res = await loginAction(form("another@example.com"));
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/^Slow down/) });
    expect(signInWithPassword).toHaveBeenCalledTimes(20);
  });

  it("stops one account after 10 attempts even from rotating IPs", async () => {
    for (let i = 0; i < 10; i++) {
      ip = `198.51.100.${i}`;
      await loginAction(form("Target@Example.com"));
    }
    ip = "198.51.100.99";
    // Case-insensitive: the limit is per account, not per spelling.
    const res = await loginAction(form("target@example.com"));
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/^Slow down/) });
    expect(signInWithPassword).toHaveBeenCalledTimes(10);
  });
});
