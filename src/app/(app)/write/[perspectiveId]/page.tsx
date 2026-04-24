import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pickPrompt } from "@/lib/prompts";
import { isLens } from "@/lib/lenses";
import { buttonClassName } from "@/components/ui/button";
import { Editor } from "./editor";

export const metadata: Metadata = {
  title: "Writing…",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: { perspectiveId: string };
}

export default async function WritePerspectivePage({ params }: PageProps) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Middleware guards /write, but re-check so the type narrows.
    redirect(`/login?next=${encodeURIComponent(`/write/${params.perspectiveId}`)}`);
  }

  // Load draft + film context in one round-trip.
  const { data: draft, error } = await supabase
    .from("perspectives")
    .select(
      "id, user_id, title, subtitle, body, lens_tags, is_private, is_draft, published_at, film:films(tmdb_id, title, year, poster_path)",
    )
    .eq("id", params.perspectiveId)
    .maybeSingle();

  if (error) {
    console.error("failed to load draft:", error);
    notFound();
  }
  if (!draft) notFound();
  if (draft.user_id !== user.id) notFound();

  // Normalize the nested film relation — Supabase types it as possibly-array
  // since we didn't mark the relationship !inner. Just grab the first row.
  const film = Array.isArray(draft.film) ? draft.film[0] : draft.film;
  if (!film) {
    // Orphan draft — shouldn't happen, but bail clean.
    notFound();
  }

  // Published pieces are immutable here. Send the user to the read view,
  // where an "Edit" button will revert-to-draft and bounce back here.
  if (!draft.is_draft) {
    redirect(`/perspective/${draft.id}`);
  }

  const initialLenses = (draft.lens_tags ?? []).filter(isLens);
  const prompt = pickPrompt(draft.id);

  return (
    <div className="mx-auto max-w-reading px-6 py-10">
      {/* Film context strip */}
      <div className="flex items-center justify-between gap-4 border-b border-rule pb-4">
        <Link
          href={`/film/${film.tmdb_id}`}
          className="truncate font-mono text-meta-sm uppercase text-ink-muted hover:text-ink hover:underline"
        >
          On <span className="text-ink">{film.title}</span>
          {film.year ? ` · ${film.year}` : ""}
        </Link>
        <Link
          href={`/film/${film.tmdb_id}`}
          className={buttonClassName("ghost", "sm")}
        >
          Exit
        </Link>
      </div>

      <p className="mt-6 font-body text-reading italic text-ink-muted">
        {prompt}
      </p>

      <div className="mt-8">
        <Editor
          perspectiveId={draft.id}
          initialTitle={draft.title ?? ""}
          initialSubtitle={draft.subtitle ?? ""}
          initialBody={draft.body ?? ""}
          initialLenses={initialLenses}
          initialIsPrivate={draft.is_private ?? false}
        />
      </div>
    </div>
  );
}
