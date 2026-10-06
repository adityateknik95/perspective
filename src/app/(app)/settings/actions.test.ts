import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimits } from "@/lib/rate-limit";
import { uploadAvatarAction } from "./actions";

// Mocks record what the action did to Storage and to profiles so the tests
// can assert on order-sensitive behaviour (sniff before upload, delete old
// files only after the profile points at the new one).

const USER = "0b3f2a8e-5a1c-4c9e-9f0a-1d2e3f4a5b6c";
const storage = {
  upload: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
};
const profileUpdate = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: USER } } }) },
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => storage.upload(...a),
        remove: (...a: unknown[]) => storage.remove(...a),
        list: (...a: unknown[]) => storage.list(...a),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://abcd.supabase.co/storage/v1/object/public/avatars/${path}` },
        }),
      }),
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (row: unknown) => ({ eq: async () => profileUpdate(row) }),
    }),
  }),
}));

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];

function form(bytes: number[] | string, type: string) {
  const f = new FormData();
  const body = typeof bytes === "string" ? bytes : new Uint8Array(bytes);
  f.set("avatar", new File([body], "a", { type }));
  return f;
}

beforeEach(() => {
  storage.upload.mockReset().mockResolvedValue({ error: null });
  storage.remove.mockReset().mockResolvedValue({ error: null });
  storage.list.mockReset().mockResolvedValue({
    data: [{ name: "1600000000.jpg" }, { name: "orphan.webp" }],
    error: null,
  });
  profileUpdate.mockReset().mockReturnValue({ error: null });
});
afterEach(() => __resetRateLimits());

describe("uploadAvatarAction", () => {
  it("rejects an SVG that claims to be a PNG, before uploading anything", async () => {
    const res = await uploadAvatarAction(form('<svg onload="alert(1)"/>', "image/png"));
    expect(res).toEqual({ ok: false, error: "Use a JPG, PNG, or WebP image." });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("stores a real PNG as image/png even when the browser said text/plain", async () => {
    const res = await uploadAvatarAction(form(PNG, "text/plain"));
    expect(res.ok).toBe(true);
    const [path, , opts] = storage.upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${USER}/\\d+\\.png$`));
    expect(opts).toMatchObject({ contentType: "image/png", upsert: false });
  });

  it("writes avatar_url through the service role, then deletes the old files", async () => {
    await uploadAvatarAction(form(PNG, "image/png"));
    expect(profileUpdate).toHaveBeenCalledWith({
      avatar_url: expect.stringMatching(new RegExp(`/avatars/${USER}/\\d+\\.png$`)),
    });
    expect(storage.remove).toHaveBeenCalledWith([`${USER}/1600000000.jpg`, `${USER}/orphan.webp`]);
    expect(profileUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      storage.remove.mock.invocationCallOrder[0],
    );
  });

  it("keeps the old avatar and removes the new upload if the profile write fails", async () => {
    profileUpdate.mockReturnValue({ error: { message: "boom" } });
    const res = await uploadAvatarAction(form(PNG, "image/png"));
    expect(res).toEqual({ ok: false, error: "boom" });
    const uploaded = storage.upload.mock.calls[0][0];
    expect(storage.remove).toHaveBeenCalledTimes(1);
    expect(storage.remove).toHaveBeenCalledWith([uploaded]);
    expect(storage.list).not.toHaveBeenCalled();
  });

  it("rejects files over 5 MB without reading them", async () => {
    const big = new FormData();
    big.set("avatar", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }));
    expect(await uploadAvatarAction(big)).toEqual({ ok: false, error: "Image must be under 5 MB." });
  });
});
