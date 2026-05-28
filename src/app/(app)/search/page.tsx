import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isReservedUsername } from "@/lib/reserved-usernames";
import type { ProfileRowData } from "@/components/profile-row";
import { PeopleSearch } from "./people-search";

export const metadata: Metadata = {
  title: "Find people",
};

// Find-people surface. Public — anonymous visitors can search too, since
// /<username> is also public. Signed-in viewers get Follow buttons on
// the results; signed-out viewers get a sign-in CTA on click.
//
// The page itself is a thin server-component shell. The interesting work
// lives in <PeopleSearch />, which debounces input + drives /api/people-search.
export default async function SearchPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Which profiles does the viewer already follow? We pass the set down so
  // the FollowButton on each row starts in the correct state instead of
  // round-tripping to the DB per row.
  let followingUsernames: string[] = [];
  if (user) {
    const { data } = await supabase
      .from("follows")
      .select("following:profiles!follows_following_id_fkey(username)")
      .eq("follower_id", user.id);
    followingUsernames = (data ?? [])
      .map((row) => {
        const f = Array.isArray(row.following) ? row.following[0] : row.following;
        return f?.username ?? null;
      })
      .filter((u): u is string => !!u);
  }

  // Seed the empty state with recently-joined writers so the page isn't a
  // blank prompt. We only suggest onboarded profiles (display name set) so
  // half-formed accounts don't surface, exclude the viewer, and over-fetch
  // a little to absorb the reserved-name + self filters.
  const { data: recentRows } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, is_private, signature_lenses, created_at")
    .not("display_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(12);

  const suggestions: ProfileRowData[] = (recentRows ?? [])
    .filter((p) => p.id !== user?.id)
    .filter((p) => !isReservedUsername(p.username))
    .filter((p) => (p.display_name ?? "").trim().length > 0)
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name ?? "",
      avatar_url: p.avatar_url,
      bio: p.bio,
      is_private: p.is_private,
      signature_lenses: p.signature_lenses ?? [],
    }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-8">
        <p className="font-mono text-meta-sm uppercase text-ink-muted">
          Find people
        </p>
        <h1 className="mt-3 font-display text-display-sm text-ink sm:text-display-md">
          Who else writes here<span className="italic">?</span>
        </h1>
        <p className="mt-3 max-w-prose font-body text-reading text-ink-soft">
          Search by username or display name. Follow the writers whose
          perspectives you want to keep reading.
        </p>
      </header>

      <PeopleSearch
        isSignedIn={!!user}
        followingUsernames={followingUsernames}
        suggestions={suggestions}
      />
    </div>
  );
}
