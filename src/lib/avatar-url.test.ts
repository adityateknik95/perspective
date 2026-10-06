import { describe, expect, it } from "vitest";
import { isTrustedAvatarUrl } from "./avatar-url";

const PROJECT = "https://abcd.supabase.co";
const ok = `${PROJECT}/storage/v1/object/public/avatars/0b3f2a8e-5a1c-4c9e-9f0a-1d2e3f4a5b6c/1700000000.png`;

describe("isTrustedAvatarUrl", () => {
  it("accepts our own bucket's public objects", () => {
    expect(isTrustedAvatarUrl(ok, PROJECT)).toBe(true);
  });

  it.each([
    ["another host", "https://tracker.example/storage/v1/object/public/avatars/x/1.png"],
    ["another Supabase project", "https://evil.supabase.co/storage/v1/object/public/avatars/x/1.png"],
    ["another bucket", `${PROJECT}/storage/v1/object/public/other/x/1.png`],
    ["signed / private object path", `${PROJECT}/storage/v1/object/sign/avatars/x/1.png`],
    ["http downgrade", ok.replace("https:", "http:")],
    ["userinfo trick", `https://abcd.supabase.co@tracker.example/storage/v1/object/public/avatars/x/1.png`],
    ["not a URL", "javascript:alert(1)"],
    ["empty", ""],
  ])("rejects %s", (_name, src) => {
    expect(isTrustedAvatarUrl(src, PROJECT)).toBe(false);
  });

  it("rejects everything when the project URL is unknown", () => {
    expect(isTrustedAvatarUrl(ok, undefined)).toBe(false);
  });
});
