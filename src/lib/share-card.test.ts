import { describe, expect, it } from "vitest";
import { SHARE_TITLE_MAX, shareCardText, truncate } from "./share-card";

const base = {
  title: "The house kept the shape of her",
  authorDisplayName: "Mara Ellis",
  authorUsername: "mara",
  filmTitle: "Still Walking",
  filmYear: 2008,
  lenses: ["grief", "family", "memory"],
};

describe("shareCardText", () => {
  it("builds title, byline, film line and lenses", () => {
    const t = shareCardText(base);
    expect(t.title).toBe(base.title);
    expect(t.byline).toBe("by Mara Ellis");
    expect(t.film).toMatch(/^On Still Walking, /);
    expect(t.lenses).toEqual(["grief", "family", "memory"]);
  });

  it("falls back to @username when there's no display name", () => {
    expect(shareCardText({ ...base, authorDisplayName: "  " }).byline).toBe("by @mara");
  });

  it("omits the year when unknown and caps lenses at three", () => {
    const t = shareCardText({ ...base, filmYear: null, lenses: ["a", "b", "c", "d"] });
    expect(t.film).toBe("On Still Walking");
    expect(t.lenses).toHaveLength(3);
  });

  it("keeps long titles on the card", () => {
    const t = shareCardText({ ...base, title: "word ".repeat(60) });
    expect(t.title.length).toBeLessThanOrEqual(SHARE_TITLE_MAX);
    expect(t.title.endsWith("…")).toBe(true);
  });
});

describe("truncate", () => {
  it("prefers a word boundary", () => {
    expect(truncate("alpha beta gamma delta", 15)).toBe("alpha beta…");
  });
  it("hard-cuts a single long word", () => {
    expect(truncate("x".repeat(30), 10)).toBe(`${"x".repeat(9)}…`);
  });
  it("leaves short text alone and collapses whitespace", () => {
    expect(truncate("  a   b  ", 10)).toBe("a b");
  });
});
