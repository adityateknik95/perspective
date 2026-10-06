import { ImageResponse } from "next/og";
import { createAnonClient } from "@/lib/supabase/anon";
import { isLens } from "@/lib/lenses";
import { shareCardText, type ShareCardText } from "@/lib/share-card";

// Dynamic share card for /perspective/<id>. Next wires this up as og:image
// (and twitter-image.tsx re-exports it) automatically.
//
// Read with the cookie-less anon client: the card is what a stranger can
// see, never what the requester can. Drafts, private pieces, hidden pieces
// and pieces by private profiles fall through RLS to the generic card, so a
// share card can't leak them — even when the author shares the link.

export const alt = "A perspective on Perspective";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Light palette from globals.css (:root). Share cards are always light.
const CREAM = "rgb(242 235 221)";
const CREAM_DEEP = "rgb(232 223 204)";
const INK = "rgb(26 21 18)";
const INK_MUTED = "rgb(107 94 82)";
const WINE = "rgb(107 31 43)";
const RULE = "rgb(201 190 168)";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadCard(id: string): Promise<ShareCardText | null> {
  if (!UUID.test(id)) return null;
  const { data } = await createAnonClient()
    .from("perspectives")
    .select(
      "title, lens_tags, film:films!inner(title, year), author:profiles!inner(username, display_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const film = Array.isArray(data.film) ? data.film[0] : data.film;
  const author = Array.isArray(data.author) ? data.author[0] : data.author;
  if (!film || !author) return null;
  return shareCardText({
    title: data.title,
    authorDisplayName: author.display_name,
    authorUsername: author.username,
    filmTitle: film.title,
    filmYear: film.year,
    lenses: (data.lens_tags ?? []).filter(isLens),
  });
}

export default async function Image({ params }: { params: { perspectiveId: string } }) {
  const card = await loadCard(params.perspectiveId);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: CREAM,
          color: INK,
          padding: "64px 72px",
          borderLeft: `16px solid ${WINE}`,
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: INK_MUTED, textTransform: "uppercase" }}>
          {card ? card.film : "Perspective"}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: card ? 64 : 72, lineHeight: 1.12, fontWeight: 700 }}>
            {card ? `${card.title}.` : "A place for how you saw it, not how you rated it."}
          </div>
          {card && (
            <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: INK_MUTED }}>{card.byline}</div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `2px solid ${RULE}`,
            paddingTop: 28,
          }}
        >
          <div style={{ display: "flex", gap: 14 }}>
            {(card?.lenses ?? []).map((lens) => (
              <div
                key={lens}
                style={{
                  display: "flex",
                  border: `2px solid ${RULE}`,
                  background: CREAM_DEEP,
                  padding: "8px 18px",
                  fontSize: 22,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                }}
              >
                {lens}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: WINE }}>Perspective</div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        // Replaces ImageResponse's default `public, immutable, max-age=1y`
        // (the key must be lowercase to override it, not sit beside it).
        // A year is wrong here: the card has to change when the title does,
        // and disappear when the piece goes private. One hour at the CDN
        // still absorbs a burst of unfurls.
        "cache-control": "public, max-age=0, s-maxage=3600",
      },
    },
  );
}
