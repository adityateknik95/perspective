import { describe, expect, it } from "vitest";
import {
  applyOptimisticReaction,
  dominantReaction,
  summarySentence,
  EMPTY_REACTION_SUMMARY,
  type ReactionSummary,
} from "./reactions";

function makeSummary(partial: Partial<ReactionSummary>): ReactionSummary {
  const filled = { ...EMPTY_REACTION_SUMMARY, ...partial };
  filled.total =
    filled.moved +
    filled.changed_my_mind +
    filled.recognized_myself +
    filled.saw_it_differently +
    filled.stayed_with_me;
  return filled;
}

describe("applyOptimisticReaction", () => {
  it("returns an unchanged copy when prev === next", () => {
    const s = makeSummary({ moved: 3 });
    const out = applyOptimisticReaction(s, "moved", "moved");
    expect(out).toEqual(s);
    expect(out).not.toBe(s); // copy, not same ref
  });

  it("adds 1 when viewer reacts for the first time", () => {
    const s = makeSummary({ moved: 3 });
    const out = applyOptimisticReaction(s, null, "moved");
    expect(out.moved).toBe(4);
    expect(out.total).toBe(4);
  });

  it("subtracts 1 when viewer clears a reaction", () => {
    const s = makeSummary({ moved: 3 });
    const out = applyOptimisticReaction(s, "moved", null);
    expect(out.moved).toBe(2);
    expect(out.total).toBe(2);
  });

  it("moves the count when viewer switches reaction type", () => {
    const s = makeSummary({ moved: 3, stayed_with_me: 1 });
    const out = applyOptimisticReaction(s, "moved", "stayed_with_me");
    expect(out.moved).toBe(2);
    expect(out.stayed_with_me).toBe(2);
    expect(out.total).toBe(4); // unchanged: one out, one in
  });

  it("never goes below zero on a desync", () => {
    // Simulates the case where the local 'prev' claims a reaction but the
    // server's summary doesn't reflect it yet.
    const s = makeSummary({});
    const out = applyOptimisticReaction(s, "moved", null);
    expect(out.moved).toBe(0);
    expect(out.total).toBe(0);
  });
});

describe("dominantReaction", () => {
  it("returns null when total is 0", () => {
    expect(dominantReaction(EMPTY_REACTION_SUMMARY)).toBeNull();
  });

  it("returns the only non-zero type", () => {
    expect(dominantReaction(makeSummary({ stayed_with_me: 1 }))).toBe(
      "stayed_with_me",
    );
  });

  it("returns the highest count when there's a clear winner", () => {
    expect(
      dominantReaction(makeSummary({ moved: 2, changed_my_mind: 7 })),
    ).toBe("changed_my_mind");
  });

  it("breaks ties by canonical order (REACTION_TYPES[0] first)", () => {
    // moved and stayed_with_me both at 3 — moved wins because it's earlier
    // in REACTION_TYPES.
    expect(
      dominantReaction(makeSummary({ moved: 3, stayed_with_me: 3 })),
    ).toBe("moved");
  });
});

describe("summarySentence", () => {
  it("returns empty string when there are no reactions", () => {
    expect(summarySentence(EMPTY_REACTION_SUMMARY)).toBe("");
  });

  it("uses singular forms for count === 1", () => {
    const out = summarySentence(makeSummary({ moved: 1 }));
    expect(out).toBe("1 person was moved");
  });

  it("uses plural forms for count > 1", () => {
    const out = summarySentence(makeSummary({ moved: 42 }));
    expect(out).toBe("42 people were moved");
  });

  it("joins multiple types in canonical order with middle dots", () => {
    const out = summarySentence(
      makeSummary({ moved: 5, changed_my_mind: 2, stayed_with_me: 1 }),
    );
    expect(out).toBe(
      "5 people were moved · 2 people changed their mind · 1 person stayed with it",
    );
  });

  it("skips zero-count types", () => {
    const out = summarySentence(makeSummary({ moved: 3, stayed_with_me: 0 }));
    expect(out).toBe("3 people were moved");
  });
});
