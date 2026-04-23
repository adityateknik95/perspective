import "server-only";
import sanitize from "sanitize-html";

// Whitelist for Tiptap's HTML output. Every tag & attribute a user can produce
// in the editor is enumerated here; anything else is stripped. Run this on
// every write path before the body hits the DB — never trust client HTML.
//
// Tiptap produces:
//   paragraphs, hard breaks, horizontal rules
//   bold (<strong>), italic (<em>), underline (<u>)
//   headings h2–h3 (we disable h1 in the editor; the title is H1)
//   blockquote
//   ordered/unordered lists (ul, ol, li)
//   links (<a href> — http(s) only, no javascript:)

const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "strong",
  "em",
  "u",
  "h2",
  "h3",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
];

export function sanitizeBodyHtml(html: string): string {
  return sanitize(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "rel", "target"],
    },
    // Drop any protocol other than http / https / mailto. Blocks javascript:
    // and data: URI attacks in <a href>.
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href"],
    // Strip empty tags that add nothing but noise.
    exclusiveFilter: (frame) =>
      ["p", "h2", "h3", "blockquote", "li"].includes(frame.tag) &&
      frame.text.trim().length === 0 &&
      Object.keys(frame.attribs).length === 0,
    transformTags: {
      // Force external links to open safely and tell search engines not to
      // follow user-supplied URLs.
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const isExternal = /^https?:\/\//i.test(href);
        return {
          tagName: "a",
          attribs: {
            href,
            ...(isExternal
              ? { rel: "nofollow noopener noreferrer", target: "_blank" }
              : {}),
          },
        };
      },
    },
  });
}

// Strip every tag down to plaintext. Used for word counts, excerpts, OG meta.
export function htmlToPlaintext(html: string): string {
  return sanitize(html, {
    allowedTags: [],
    allowedAttributes: {},
    // Collapse block-level elements into newlines so paragraphs remain
    // distinguishable in the plaintext.
    textFilter: (text) => text,
  })
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
