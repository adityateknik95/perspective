// The one place that decides whether a user-supplied `next` value is safe to
// redirect to. Used by the login action, the OAuth / email callback, and the
// login form (which forwards `next` into the Google flow).
//
// The old inline checks were `startsWith("/") && !startsWith("//")`, which
// lets "/\evil.com" through: browsers treat "\" as "/" in special-scheme
// URLs, so that resolves to https://evil.com. Control characters are a
// similar trap — "/\t/evil.com" has a tab stripped by the URL parser and
// becomes "//evil.com".
//
// Rule: same-origin path only. We reject anything ambiguous outright rather
// than trying to normalise it, then let the WHATWG URL parser (the same one
// the browser will use) confirm the result stays on our origin.

const MAX_LENGTH = 2048;

// C0 controls, DEL, and C1 controls. Written as code points rather than a
// regex literal so the source stays free of raw control characters.
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) return true;
  }
  return false;
}

// Placeholder origin for parsing. Never leaves this function.
const BASE = "http://perspective.invalid";

export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > MAX_LENGTH) return null;

  // Must be a rooted path, and not protocol-relative.
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;

  // Backslashes are never legitimate in our paths, and browsers read them
  // as slashes. Reject both raw and percent-encoded forms anywhere.
  if (raw.includes("\\") || /%5c/i.test(raw)) return null;

  if (hasControlChars(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;

  // Re-serialise from the parsed URL so what we redirect to is exactly what
  // we validated (no dot-segment or encoding surprises).
  return `${url.pathname}${url.search}${url.hash}`;
}
