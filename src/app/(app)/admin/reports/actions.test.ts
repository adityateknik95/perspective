import { beforeEach, describe, expect, it, vi } from "vitest";
import { dismissReportsAction, hideContentAction, unhideContentAction } from "./actions";

// requireAdmin is the only thing between a caller and the service role here,
// so these tests are mostly about who gets through.

const ADMIN = "0b3f2a8e-5a1c-4c9e-9f0a-1d2e3f4a5b6c";
const OTHER = "1c4e3b9f-6b2d-4d0f-8a1b-2e3f4a5b6c7d";
const TARGET = "2d5f4c0a-7c3e-4e1a-9b2c-3f4a5b6c7d8e";

let viewer: { id: string } | null;
const writes: Array<{ table: string; patch: Record<string, unknown>; filters: Array<[string, unknown]> }> = [];

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: viewer } }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const entry = { table, patch: {} as Record<string, unknown>, filters: [] as Array<[string, unknown]> };
      const q = {
        update(patch: Record<string, unknown>) {
          entry.patch = patch;
          writes.push(entry);
          return q;
        },
        select: () => q,
        eq(col: string, val: unknown) {
          entry.filters.push([col, val]);
          return q;
        },
        maybeSingle: async () => ({ data: { perspective_id: "p1" } }),
        then: (resolve: (v: unknown) => void) => resolve({ data: [{ id: TARGET }], error: null }),
      };
      return q;
    },
  }),
}));

const target = { targetType: "perspective" as const, targetId: TARGET };

beforeEach(() => {
  writes.length = 0;
  vi.stubEnv("ADMIN_USER_IDS", ADMIN);
});

describe("moderation actions", () => {
  it.each([
    ["signed out", null],
    ["signed in, not an admin", { id: OTHER }],
  ])("404 and write nothing when %s", async (_name, v) => {
    viewer = v;
    for (const action of [hideContentAction, unhideContentAction, dismissReportsAction]) {
      await expect(action(target)).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(writes).toHaveLength(0);
  });

  it("hide: stamps hidden_at/hidden_by and closes open reports", async () => {
    viewer = { id: ADMIN };
    expect(await hideContentAction(target)).toEqual({ ok: true });
    expect(writes[0]).toMatchObject({
      table: "perspectives",
      patch: { hidden_at: expect.any(String), hidden_by: ADMIN },
      filters: [["id", TARGET]],
    });
    expect(writes[1]).toMatchObject({
      table: "reports",
      patch: { status: "actioned", resolved_by: ADMIN },
      filters: [
        ["target_type", "perspective"],
        ["target_id", TARGET],
        ["status", "open"],
      ],
    });
  });

  it("unhide clears the flags and leaves reports alone", async () => {
    viewer = { id: ADMIN };
    await unhideContentAction({ targetType: "response", targetId: TARGET });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ table: "responses", patch: { hidden_at: null, hidden_by: null } });
  });

  it("dismiss only resolves reports", async () => {
    viewer = { id: ADMIN };
    await dismissReportsAction(target);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ table: "reports", patch: { status: "dismissed" } });
  });

  it("rejects a malformed target even for admins", async () => {
    viewer = { id: ADMIN };
    const res = await hideContentAction({ targetType: "perspective", targetId: "nope" });
    expect(res.ok).toBe(false);
    expect(writes).toHaveLength(0);
  });
});
