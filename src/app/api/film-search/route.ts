import { NextResponse, type NextRequest } from "next/server";
import { searchFilms } from "@/lib/tmdb/client";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

// TMDB's quota is shared by every visitor, and this endpoint is public, so
// it's keyed by IP. The combobox debounces keystrokes, so a real person
// typing stays well under a request a second.
const RATE = { max: 60, windowMs: 60_000 };

// GET /api/film-search?q=<query>
// Server-side proxy to TMDB. Keeps the bearer token off the client, and
// lets Next's fetch cache dedup repeated queries across users. Returns a
// shape our UI can consume directly.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length === 0) {
    return NextResponse.json({ results: [] });
  }
  if (q.length > 200) {
    return NextResponse.json(
      { error: "Query too long." },
      { status: 400 },
    );
  }

  const limit = await checkRateLimit(`film-search:${clientIp(request.headers)}`, RATE);
  if (!limit.ok) {
    return NextResponse.json(
      { error: rateLimitMessage(limit) },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.resetIn / 1000)) },
      },
    );
  }

  try {
    const results = await searchFilms(q);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("film-search failed:", err);
    return NextResponse.json(
      { error: "Search failed." },
      { status: 500 },
    );
  }
}
