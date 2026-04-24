import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateFilmByTmdbId } from "@/lib/films";
import { StartForm } from "./start-form";

export const metadata: Metadata = {
  title: "New perspective",
};

interface PageProps {
  searchParams: { film?: string };
}

// Two shapes:
//   /write/new?film=<tmdbId> — create a draft for that film, redirect to
//                               the editor. The common path from film pages.
//   /write/new               — show a film picker. Entry point from the
//                               header / keyboard shortcut.
//
// Creation-on-GET is intentional: the click on "Write a perspective" is the
// user's confirmation. Middleware guarantees we have an authenticated user.
export default async function NewPerspectivePage({ searchParams }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Middleware should have caught this; belt-and-suspenders redirect.
    redirect(
      `/login?next=${encodeURIComponent(
        searchParams.film
          ? `/write/new?film=${searchParams.film}`
          : "/write/new",
      )}`,
    );
  }

  const tmdbIdParam = searchParams.film;
  if (!tmdbIdParam) {
    return <StartForm />;
  }

  const tmdbId = Number(tmdbIdParam);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return <StartForm />;
  }

  const entry = await getOrCreateFilmByTmdbId(tmdbId);
  if (!entry) {
    return <StartForm />;
  }

  // Insert a draft row and send the user to the editor. We never collapse
  // duplicate empty drafts on the same film — making a second draft is
  // cheap, and collapsing would risk blowing away the half-typed one.
  const { data: draft, error } = await supabase
    .from("perspectives")
    .insert({
      user_id: user.id,
      film_id: entry.film.id,
      title: "",
      body: "",
      body_plaintext: "",
      lens_tags: [],
      word_count: 0,
      reading_time_minutes: 0,
      is_draft: true,
      is_private: false,
    })
    .select("id")
    .single();

  if (error || !draft) {
    console.error("failed to create draft:", error);
    return <StartForm error="Couldn't start a draft. Try again?" />;
  }

  redirect(`/write/${draft.id}`);
}
