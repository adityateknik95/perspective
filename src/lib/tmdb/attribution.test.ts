import { describe, expect, it } from "vitest";
import { TMDB_LOGO_HEIGHT_PX, TMDB_NOTICE } from "./attribution";

describe("TMDB attribution", () => {
  it("uses the exact notice wording the TMDB terms require", () => {
    expect(TMDB_NOTICE).toBe(
      "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    );
  });

  it("keeps the TMDB logo smaller than our wordmark (terms: less prominent)", () => {
    // Our <Logo> renders at text-reading-lg (~20px) or larger.
    expect(TMDB_LOGO_HEIGHT_PX).toBeLessThan(20);
  });
});
