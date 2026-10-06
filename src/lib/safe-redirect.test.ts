import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

// Every rejected case here is one a browser would resolve off-origin (or
// that we refuse to reason about). Accepted cases are the shapes the app
// actually produces: /login?next=/perspective/<id>, /write/new?film=123, etc.

describe("safeNextPath", () => {
  it.each([
    "/",
    "/onboarding",
    "/perspective/0b3f2a8e-5a1c-4c9e-9f0a-1d2e3f4a5b6c",
    "/write/new?film=550",
    "/alice#journals",
    "/film/550?lens=grief&page=2",
  ])("accepts same-origin path %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    ["backslash host", "/\\evil.com"],
    ["backslash after slash", "/\\/evil.com"],
    ["double backslash", "\\\\evil.com"],
    ["backslash mid-path", "/foo\\bar"],
    ["encoded backslash", "/%5Cevil.com"],
    ["encoded backslash lowercase", "/%5cevil.com"],
    ["protocol-relative", "//evil.com"],
    ["protocol-relative with path", "//evil.com/login"],
    ["absolute https", "https://evil.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["no leading slash", "evil.com"],
    ["tab smuggling", "/\t/evil.com"],
    ["newline smuggling", "/\n/evil.com"],
    ["carriage return", "/foo\r\nSet-Cookie: x=1"],
    ["null byte", "/foo\u0000"],
    ["DEL", "/foo\u007f"],
    ["C1 control", "/foo\u0085"],
    ["empty", ""],
  ])("rejects %s", (_name, value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it("rejects non-strings (FormData can hand us a File)", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(42)).toBeNull();
    expect(safeNextPath({ toString: () => "/ok" })).toBeNull();
  });

  it("rejects absurdly long values", () => {
    expect(safeNextPath(`/${"a".repeat(5000)}`)).toBeNull();
  });

  it("normalises dot segments instead of passing them through", () => {
    expect(safeNextPath("/a/../settings")).toBe("/settings");
    // Dot segments can't climb above the origin root.
    expect(safeNextPath("/../../evil.com")).toBe("/evil.com");
  });
});
