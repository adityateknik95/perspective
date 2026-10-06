import { describe, expect, it } from "vitest";
import { promptParts } from "./prompt-parts";
import { WRITING_PROMPTS } from "./prompts";

describe("promptParts", () => {
  it("splits emphasis runs", () => {
    expect(promptParts("What did it make you *see* that you hadn't?")).toEqual([
      { text: "What did it make you ", em: false },
      { text: "see", em: true },
      { text: " that you hadn't?", em: false },
    ]);
  });

  it("treats markup-looking text as text (no HTML is ever produced)", () => {
    expect(promptParts("<b>hi</b>")).toEqual([{ text: "<b>hi</b>", em: false }]);
  });

  it("round-trips every shipped prompt", () => {
    for (const p of WRITING_PROMPTS) {
      expect(promptParts(p).map((x) => (x.em ? `*${x.text}*` : x.text)).join("")).toBe(p);
    }
  });
});
