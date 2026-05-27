import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { isReservedUsername } from "@/lib/reserved-usernames";

// GET /api/people-search?q=ma
//   200 { results: Profile[] }
//   400 { error: string }    — query too short / too long
//   429 { error: string }    — rate-limited
//   500 { error: string }    — server error
//
// Searches by username prefix OR display_name contains, case-insensitive.
// Returns up to LIMIT profiles. Self is excluded from results (you can't
// follow yourself). Reserved usernames can't be registered, but we also
// filter them defensively in case the list ever changes.
//
// Privacy: profile rows are publicly readable via RLS, so we don't gate
// the endpoint by auth — anyone can find a username, which matches how
// /<username> already behaves. Private profiles surface in results so
// followers can find each other; the row carries an `is_private` flag
// and the destination page shows the private shell.

const MIN_QUERY = 2;
const MAX_QUERY = 50;
const RESULT_LIMIT = 20;

export type PeopleSearchResult = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean;
  signature_lenses: string[];
};

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("q") ?? "";
  const query = raw.trim();

  if (query.length < MIN_QUERY) {
    return NextResponse.json(
      { error: `Type at least ${MIN_QUERY} characters.` },
      { status: 400 },
    );
  }
  if (query.length > MAX_QUERY) {
    return NextResponse.json(
      { error: "Search query is too long." },
      { status: 400 },
    );
  }

  const supabase = createClient();

  // Auth is optional. We pull the viewer to exclude them from results, but
  // anonymous visitors can still search.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rate limit keyed by user when signed in, by IP-derived header otherwise.
  // The IP-fallback isn't perfect on Vercel (x-forwarded-for can be spoofed
  // off-platform) but it's a coarse abuse brake — the real protection is
  // that this endpoint is read-only and idempotent.
  const limitKey = user?.id
    ? `people-search:${user.id}`
    : `people-search:ip:${request.headers.get("x-forwarded-for")?.split(",")[0] ?? "anon"}`;
  const limit = checkRateLimit(limitKey, { max: 60, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Slow down — try again in ${Math.ceil(limit.resetIn / 1000)}s.` },
      { status: 429 },
    );
  }

  // PostgREST escape: commas and parens inside .or() values need encoding.
  // Our query is already trimmed; further-escape special chars so a stray
  // "(" or "%" doesn't break the filter parse.
  const esc = (s: string) => s.replace(/[(),*]/g, "");
  const safe = esc(query);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, is_private, signature_lenses")
    .or(`username.ilike.${safe}%,display_name.ilike.%${safe}%`)
    .order("username", { ascending: true })
    .limit(RESULT_LIMIT * 2); // over-fetch so post-filtering still has headroom

  if (error) {
    console.error("people-search failed:", error);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }

  const filtered = (data ?? [])
    .filter((p) => p.id !== user?.id)
    .filter((p) => !isReservedUsername(p.username))
    .slice(0, RESULT_LIMIT)
    .map<PeopleSearchResult>((p) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      bio: p.bio,
      is_private: p.is_private,
      signature_lenses: p.signature_lenses ?? [],
    }));

  return NextResponse.json({ results: filtered });
}
