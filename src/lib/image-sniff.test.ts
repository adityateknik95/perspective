import { describe, expect, it } from "vitest";
import { sniffImageType } from "./image-sniff";

const bytes = (...parts: Array<number[] | string>) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p)));

describe("sniffImageType", () => {
  it("recognises JPEG, PNG and WebP by magic bytes", () => {
    expect(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF"))?.mime).toBe("image/jpeg");
    expect(sniffImageType(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))?.mime).toBe("image/png");
    expect(sniffImageType(bytes("RIFF", [1, 2, 3, 4], "WEBPVP8 "))?.mime).toBe("image/webp");
  });

  it.each([
    ["SVG (scriptable)", bytes('<svg xmlns="http://www.w3.org/2000/svg">')],
    ["HTML", bytes("<!doctype html><script>")],
    ["GIF", bytes("GIF89a", [0, 0, 0, 0, 0, 0])],
    ["RIFF that isn't WebP (WAV)", bytes("RIFF", [1, 2, 3, 4], "WAVEfmt ")],
    ["truncated PNG header", bytes([0x89], "PNG")],
    ["empty", new Uint8Array()],
  ])("rejects %s regardless of claimed MIME", (_name, input) => {
    expect(sniffImageType(input)).toBeNull();
  });
});
