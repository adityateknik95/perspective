import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimits } from "@/lib/rate-limit";
import { confirmsUsername } from "@/lib/validation/profile";
import { deleteAccountAction } from "./delete-account-action";

const USER = "0b3f2a8e-5a1c-4c9e-9f0a-1d2e3f4a5b6c";

const redirect = vi.fn((url: string) => {
  // next/navigation's redirect throws to unwind; mirror that.
  throw new Error(`REDIRECT ${url}`);
});
const signOut = vi.fn(async () => ({ error: null }));
const deleteUser = vi.fn();
const list = vi.fn();
const remove = vi.fn();

vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: USER } } }),
      signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { username: "alice" } }) }),
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser: (id: string) => deleteUser(id) } },
    storage: { from: () => ({ list, remove }) },
  }),
}));

const form = (confirmation: string) => {
  const f = new FormData();
  f.set("confirmation", confirmation);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  deleteUser.mockResolvedValue({ error: null });
  list.mockResolvedValue({ data: [{ name: "1.png" }, { name: "2.webp" }] });
  remove.mockResolvedValue({ error: null });
});
afterEach(() => __resetRateLimits());

describe("deleteAccountAction", () => {
  it("does nothing unless the username is typed exactly", async () => {
    const res = await deleteAccountAction(form("alicia"));
    expect(res).toMatchObject({ ok: false, fieldErrors: { confirmation: "Type alice to confirm." } });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("requires something to be typed", async () => {
    expect((await deleteAccountAction(form("   "))).ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("removes avatar files, deletes the auth user, signs out, then redirects", async () => {
    await expect(deleteAccountAction(form(" ALICE "))).rejects.toThrow("REDIRECT /?account=deleted");
    expect(remove).toHaveBeenCalledWith([`${USER}/1.png`, `${USER}/2.webp`]);
    expect(deleteUser).toHaveBeenCalledWith(USER);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(deleteUser.mock.invocationCallOrder[0]);
  });

  it("reports a failed deletion and stays signed in", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    deleteUser.mockResolvedValue({ error: { message: "db down" } });
    const res = await deleteAccountAction(form("alice"));
    expect(res).toEqual({ ok: false, error: "Couldn't delete your account. Please try again." });
    expect(signOut).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("confirmsUsername", () => {
  it("is case-insensitive and trims, like usernames", () => {
    expect(confirmsUsername("  Alice ", "alice")).toBe(true);
    expect(confirmsUsername("alice2", "alice")).toBe(false);
  });
});
