import { beforeEach, describe, expect, it, vi } from "vitest";
import { writePerspective } from "./writer";

// writePerspective uses the service-role client, which bypasses RLS. These
// tests pin the two properties that keep that safe: every write is scoped to
// (id, user_id), and a write that matched nothing is reported as a failure.
// The database-side half (the browser role can't write these columns) is
// proven against a real Supabase by scripts/verify-social-rls.mjs.

type Call = { method: string; args: unknown[] };
const calls: Call[] = [];
let result: { data: unknown; error: { message: string } | null } = {
  data: [{ id: "p1" }],
  error: null,
};

function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ["from", "update", "eq"]) {
    b[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return b;
    };
  }
  b.select = (...args: unknown[]) => {
    calls.push({ method: "select", args });
    return Promise.resolve(result);
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => builder(),
}));

const eqs = () =>
  calls.filter((c) => c.method === "eq").map((c) => c.args as [string, unknown]);

beforeEach(() => {
  calls.length = 0;
  result = { data: [{ id: "p1" }], error: null };
});

describe("writePerspective", () => {
  it("scopes every write to the row id AND the owner", async () => {
    await writePerspective("p1", "user-a", { body: "<p>x</p>" });
    expect(eqs()).toEqual(
      expect.arrayContaining([
        ["id", "p1"],
        ["user_id", "user-a"],
      ]),
    );
  });

  it("adds an is_draft guard for autosave so the check and write are atomic", async () => {
    await writePerspective("p1", "user-a", { body: "" }, { onlyIfDraft: true });
    expect(eqs()).toContainEqual(["is_draft", true]);
  });

  it("does not add the draft guard for publish / revert", async () => {
    await writePerspective("p1", "user-a", { is_draft: false });
    expect(eqs().some(([col]) => col === "is_draft")).toBe(false);
  });

  it("fails when no row matched (wrong owner, deleted, or already shared)", async () => {
    result = { data: [], error: null };
    expect(await writePerspective("p1", "user-b", { body: "" })).toEqual({
      ok: false,
      error: "Perspective not found.",
    });
    expect(
      await writePerspective("p1", "user-a", { body: "" }, { onlyIfDraft: true }),
    ).toEqual({
      ok: false,
      error: "This perspective is shared. Revert to draft to edit.",
    });
  });

  it("surfaces database errors", async () => {
    result = { data: null, error: { message: "published_at is immutable once set" } };
    expect(await writePerspective("p1", "user-a", { published_at: "x" })).toEqual({
      ok: false,
      error: "published_at is immutable once set",
    });
  });
});
