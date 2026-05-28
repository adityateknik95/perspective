import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { USERNAME_REGEX } from "@/lib/validation/username";
import { isReservedUsername } from "@/lib/reserved-usernames";
import { ProfileRow, type ProfileRowData } from "@/components/profile-row";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClassName } from "@/components/ui/button";

interface PageProps {
  params: { username: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  return { title: `@${params.username.toLowerCase()} — followers` };
}

// People who follow @username. Public surface — anyone can see the list, in
// keeping with the rest of the app (perspectives, profile pages, follow
// counts are already public). The destination profile pages are the ones
// that gate content via the Private shell.
export default async function FollowersPage({ params }: PageProps) {
  const username = params.username.trim().toLowerCase();
  if (!USERNAME_REGEX.test(username) || isReservedUsername(username)) {
    notFound();
  }

  const supabase = createClient();

  const [{ data: profile }, { data: userData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("username", username)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (!profile) notFound();
  const viewer = userData.user;

  // Pull the followers list with a JOIN to profiles. PostgREST exposes the
  // FK via the disambiguating hint `profiles!follows_follower_id_fkey` —
  // there are two FKs from follows to profiles (follower_id, following_id)
  // so we have to be explicit about which side we want.
  const { data: rows } = await supabase
    .from("follows")
    .select(
      "created_at, follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, bio, is_private, signature_lenses)",
    )
    .eq("following_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  // Shape the join result into ProfileRowData. The join can come back as
  // either an array or a single object depending on the relationship type;
  // narrow defensively.
  const followers: ProfileRowData[] = (rows ?? [])
    .map((r) => (Array.isArray(r.follower) ? r.follower[0] : r.follower))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name ?? "",
      avatar_url: p.avatar_url,
      bio: p.bio,
      is_private: p.is_private,
      signature_lenses: p.signature_lenses ?? [],
    }));

  // The viewer's own follows — used to seed each Follow button with the
  // right state so it doesn't re-fetch per row. Empty when signed out.
  const viewerFollowing = new Set<string>();
  if (viewer && followers.length > 0) {
    const { data: viewerFollows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", viewer.id)
      .in(
        "following_id",
        followers.map((f) => f.id),
      );
    for (const row of viewerFollows ?? []) {
      viewerFollowing.add(row.following_id);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-8">
        <Link
          href={`/${profile.username}`}
          className="font-mono text-meta-sm uppercase text-ink-muted hover:text-ink"
        >
          ← @{profile.username}
        </Link>
        <h1 className="mt-4 font-display text-display-sm text-ink sm:text-display-md">
          Followers
        </h1>
        <p className="mt-2 font-mono text-meta-sm uppercase text-ink-muted">
          {followers.length} {followers.length === 1 ? "person" : "people"}{" "}
          following {profile.display_name || `@${profile.username}`}
        </p>
      </header>

      {followers.length === 0 ? (
        <EmptyState
          title="No followers yet."
          body={`Once people start following ${profile.display_name || `@${profile.username}`}, they'll appear here.`}
          action={
            viewer ? (
              <Link
                href="/search"
                className={buttonClassName("secondary", "sm")}
              >
                Find people
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {followers.map((p) => (
            <li key={p.id}>
              <ProfileRow
                profile={p}
                isSignedIn={!!viewer}
                initialFollowing={viewerFollowing.has(p.id)}
                isSelf={viewer?.id === p.id}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
