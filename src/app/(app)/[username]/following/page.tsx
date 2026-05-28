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
  return { title: `@${params.username.toLowerCase()} — following` };
}

// People @username follows. Mirror of /followers but with the FK flipped.
// Same query shape; same row renderer; same Follow-button hydration via
// the viewer's own follows set.
export default async function FollowingPage({ params }: PageProps) {
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

  // The other side of the same join — pull who @username is following.
  // The FK hint goes through follows_following_id_fkey this time.
  const { data: rows } = await supabase
    .from("follows")
    .select(
      "created_at, following:profiles!follows_following_id_fkey(id, username, display_name, avatar_url, bio, is_private, signature_lenses)",
    )
    .eq("follower_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const following: ProfileRowData[] = (rows ?? [])
    .map((r) => (Array.isArray(r.following) ? r.following[0] : r.following))
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

  const viewerFollowing = new Set<string>();
  if (viewer && following.length > 0) {
    const { data: viewerFollows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", viewer.id)
      .in(
        "following_id",
        following.map((f) => f.id),
      );
    for (const row of viewerFollows ?? []) {
      viewerFollowing.add(row.following_id);
    }
  }

  const isOwner = viewer?.id === profile.id;

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
          Following
        </h1>
        <p className="mt-2 font-mono text-meta-sm uppercase text-ink-muted">
          {profile.display_name || `@${profile.username}`} follows{" "}
          {following.length} {following.length === 1 ? "person" : "people"}
        </p>
      </header>

      {following.length === 0 ? (
        <EmptyState
          title={isOwner ? "You're not following anyone yet." : "Not following anyone yet."}
          body={
            isOwner
              ? "Find writers whose perspectives you want to read."
              : `${profile.display_name || `@${profile.username}`} hasn't followed anyone yet.`
          }
          action={
            viewer ? (
              <Link
                href="/search"
                className={buttonClassName("primary", "sm")}
              >
                Find people
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {following.map((p) => (
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
