import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimits } from "@/lib/rate-limit";
import { reportAction } from "./report-action";

const insert = vi.fn();
let user: { id: string } | null = { id: "u1" };

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({ insert: (row: unknown) => insert(row) }),
  }),
}));

const TARGET = "0b3f2a8e-5a1c-4c9e-9f0a-1d2e3f4a5b6c";
const valid = { targetType: "response" as const, targetId: TARGET, reason: "  harassment  " };

beforeEach(() => {
  user = { id: "u1" };
  insert.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => __resetRateLimits());

describe("reportAction", () => {
  it("files a trimmed report as the signed-in user", async () => {
    expect(await reportAction(valid)).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith({
      reporter_id: "u1",
      target_type: "response",
      target_id: TARGET,
      reason: "harassment",
    });
  });

  it("validates before touching the database", async () => {
    const res = await reportAction({ ...valid, reason: "   " });
    expect(res).toMatchObject({ ok: false, fieldErrors: { reason: "Tell us what's wrong." } });
    expect(insert).not.toHaveBeenCalled();
  });

  it("treats a repeat report as success", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    expect(await reportAction(valid)).toEqual({ ok: true });
  });

  it("maps an RLS rejection (target not visible) to a friendly error", async () => {
    insert.mockResolvedValue({ error: { code: "42501", message: "new row violates row-level security" } });
    expect(await reportAction(valid)).toEqual({ ok: false, error: "This can't be reported." });
  });

  it("requires sign-in", async () => {
    user = null;
    expect(await reportAction(valid)).toEqual({ ok: false, error: "Sign in to report." });
  });

  it("limits to 10 reports an hour", async () => {
    for (let i = 0; i < 10; i++) await reportAction(valid);
    expect((await reportAction(valid)).ok).toBe(false);
    expect(insert).toHaveBeenCalledTimes(10);
  });
});
