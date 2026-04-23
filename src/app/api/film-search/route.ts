import { NextResponse, type NextRequest } from "next/server";
import { searchFilms } from "@/lib/tmdb/client";

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
