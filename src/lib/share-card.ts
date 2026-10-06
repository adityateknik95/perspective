import { yearInWords } from "@/lib/year-in-words";

// Text for a perspective's Open Graph share card (1200x630). Pure so the
// truncation rules are tested; the image itself is drawn by
// app/(app)/perspective/[perspectiveId]/opengraph-image.tsx.
//
// Limits are tuned to the card's type sizes: a title past ~90 chars wraps
// to a fourth line at 64px and pushes the byline off the card.

export type ShareCardInput = {
  title: string;
  authorDisplayName: string | null;
  authorUsername: string;
  filmTitle: string;
  filmYear: number | null;
  lenses: string[];
};

export type ShareCardText = {
  title: string;
  byline: string;
  film: string;
  lenses: string[];
};

export const SHARE_TITLE_MAX = 90;
export const SHARE_FILM_MAX = 60;

export function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  // Cut at a word boundary when one is reasonably close.
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function shareCardText(input: ShareCardInput): ShareCardText {
  const author = input.authorDisplayName?.trim() || `@${input.authorUsername}`;
  const year = input.filmYear ? `, ${yearInWords(input.filmYear)}` : "";
  return {
    title: truncate(input.title || "Untitled", SHARE_TITLE_MAX),
    byline: `by ${truncate(author, 40)}`,
    film: `On ${truncate(input.filmTitle, SHARE_FILM_MAX)}${year}`,
    lenses: input.lenses.slice(0, 3),
  };
}
