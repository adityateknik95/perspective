import { describe, expect, it } from "vitest";
import { sanitizeBodyHtml, htmlToPlaintext } from "./sanitize-html";

// The allowlist is the security boundary between Tiptap output and the
// database. Anything that slips past here ends up rendered with
// dangerouslySetInnerHTML on the read view, so the tests intentionally
// hammer the cases that would matter if the allowlist regressed.

describe("sanitizeBodyHtml", () => {
  it("passes allowed tags through", () => {
    const input =
      "<p>Hello <strong>world</strong> <em>now</em> <u>note</u></p>";
    expect(sanitizeBodyHtml(input)).toBe(input);
  });

  it("preserves h2 and h3 but strips other heading levels", () => {
    expect(sanitizeBodyHtml("<h2>Two</h2>")).toBe("<h2>Two</h2>");
    expect(sanitizeBodyHtml("<h3>Three</h3>")).toBe("<h3>Three</h3>");
    // h1 / h4 / h5 / h6 get unwrapped — their text content is kept, the
    // tag itself is dropped.
    expect(sanitizeBodyHtml("<h1>One</h1>")).toBe("One");
    expect(sanitizeBodyHtml("<h4>Four</h4>")).toBe("Four");
  });

  it("preserves blockquote and lists", () => {
    expect(sanitizeBodyHtml("<blockquote>q</blockquote>")).toBe(
      "<blockquote>q</blockquote>",
    );
    expect(sanitizeBodyHtml("<ul><li>a</li><li>b</li></ul>")).toBe(
      "<ul><li>a</li><li>b</li></ul>",
    );
    expect(sanitizeBodyHtml("<ol><li>a</li></ol>")).toBe(
      "<ol><li>a</li></ol>",
    );
  });

  it("strips <script> tags and their content", () => {
    const input = "<p>hi</p><script>alert(1)</script>";
    const out = sanitizeBodyHtml(input);
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("alert");
  });

  it("strips on* event handlers from allowed tags", () => {
    const out = sanitizeBodyHtml('<p onclick="alert(1)">click</p>');
    expect(out).toBe("<p>click</p>");
  });

  it("strips javascript: hrefs", () => {
    const out = sanitizeBodyHtml('<a href="javascript:alert(1)">x</a>');
    // The href is dropped; sanitize-html leaves the anchor as a stripped
    // shell. Whatever shape it takes, it must not have the javascript: URL.
    expect(out).not.toContain("javascript:");
  });

  it("strips data: hrefs", () => {
    const out = sanitizeBodyHtml(
      '<a href="data:text/html,<script>1</script>">x</a>',
    );
    expect(out).not.toContain("data:");
  });

  it("keeps http and https hrefs and adds rel/target for external links", () => {
    const out = sanitizeBodyHtml('<a href="https://example.com">x</a>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="nofollow noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it("keeps mailto hrefs", () => {
    const out = sanitizeBodyHtml('<a href="mailto:a@b.com">x</a>');
    expect(out).toContain("mailto:a@b.com");
  });

  it("drops empty paragraphs and headings", () => {
    const out = sanitizeBodyHtml("<p></p><h2>  </h2><p>real</p>");
    expect(out).toBe("<p>real</p>");
  });

  it("strips style and class attributes on allowed tags", () => {
    const out = sanitizeBodyHtml(
      '<p style="color:red" class="x">hello</p>',
    );
    expect(out).toBe("<p>hello</p>");
  });
});

describe("htmlToPlaintext", () => {
  it("strips all tags", () => {
    expect(htmlToPlaintext("<p>hello <strong>world</strong></p>")).toBe(
      "hello world",
    );
  });

  it("collapses whitespace", () => {
    expect(htmlToPlaintext("<p>a</p>\n\n<p>b</p>")).toBe("a b");
  });

  it("converts non-breaking spaces to regular spaces", () => {
    expect(htmlToPlaintext("a b")).toBe("a b");
  });

  it("trims leading and trailing whitespace", () => {
    expect(htmlToPlaintext("   hello   ")).toBe("hello");
  });
});
