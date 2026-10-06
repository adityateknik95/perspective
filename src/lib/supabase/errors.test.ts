import { describe, expect, it } from "vitest";
import { isPermissionDenied } from "./errors";

describe("isPermissionDenied", () => {
  it("matches insufficient_privilege (RLS / column grant)", () => {
    expect(isPermissionDenied({ code: "42501" })).toBe(true);
  });

  it("ignores other failures so they keep their real message", () => {
    expect(isPermissionDenied({ code: "23505" })).toBe(false); // unique
    expect(isPermissionDenied({ code: "23514" })).toBe(false); // check
    expect(isPermissionDenied({ code: null })).toBe(false);
    expect(isPermissionDenied(null)).toBe(false);
    expect(isPermissionDenied(undefined)).toBe(false);
  });
});
