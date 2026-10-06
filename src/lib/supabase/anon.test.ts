import { describe, expect, it, vi } from "vitest";

const createClient = vi.fn((...a: unknown[]) => {
  void a;
  return {};
});
vi.mock("@supabase/supabase-js", () => ({ createClient: (...a: unknown[]) => createClient(...a) }));

import { createAnonClient } from "./anon";

describe("createAnonClient", () => {
  it("opts every request out of Next's fetch cache", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcd.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    createAnonClient();
    const opts = createClient.mock.calls[0][2] as { global: { fetch: typeof fetch } };

    const spy = vi.fn(async () => new Response("[]"));
    vi.stubGlobal("fetch", spy);
    await opts.global.fetch("https://abcd.supabase.co/rest/v1/x", { method: "GET" });
    expect(spy).toHaveBeenCalledWith("https://abcd.supabase.co/rest/v1/x", { method: "GET", cache: "no-store" });
    vi.unstubAllGlobals();
  });
});
