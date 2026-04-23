import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { USERNAME_REGEX } from "@/lib/validation/username";
import { isReservedUsername } from "@/lib/reserved-usernames";
import { Avatar } from "@/components/ui/avatar";
import { buttonClassName } from "@/components/ui/button";
import { isLens } from "@/lib/lenses";

interface PageProps {
  params: { username: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const username = params.username.toLowerCase();
  return { title: `@${username}` };
}

// The profile page is the union of three views:
//   owner     — it's you. Show private badge if enabled, plus "Edit" link.
//   public    — visible profile (either public, or you are the owner).
//   private   — exists but hidden. Instagram-style shell.
//   not-found — username is free. Route to /signup.
export default async function ProfilePage({ params }: PageProps) {
  const username = params.username.trim().toLowerCase();

  // Reject the shape early to dodge a DB call for junk paths. Reserved names
  // can never be registered, so they're guaranteed 404s for this route — the
  // Next.js route tree handles real ones (/login, /settings, etc.).
  if (!USERNAME_REGEX.test(username) || isReservedUsername(username)) {
    notFound();
  }

  const supabase = createClient();

  const [{ data: profile }, { data: userData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url, signature_lenses, is_private")
      .eq("username", username)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const viewer = userData.user;

  if (profile) {
    const isOwner = viewer?.id === profile.id;
    // Public view — or owner seeing their own profile, private or not.
    return (
      <ProfileView
        username={profile.username}
        displayName={profile.display_name ?? ""}
        bio={profile.bio}
        avatarUrl={profile.avatar_url}
        lenses={(profile.signature_lenses ?? []).filter(isLens)}
        isPrivate={profile.is_private}
        isOwner={isOwner}
      />
    );
  }

  // RLS hid the row. Could be private-not-owner, or truly unknown.
  const { data: isAvailable } = await supabase.rpc("username_available", {
    u: username,
  });

  if (isAvailable === false) {
    // Exists but private — Instagram shell.
    return <PrivateShell username={username} />;
  }

  notFound();
}

function ProfileView({
  username,
  displayName,
  bio,
  avatarUrl,
  lenses,
  isPrivate,
  isOwner,
}: {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  lenses: string[];
  isPrivate: boolean;
  isOwner: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
        <Avatar
          src={avatarUrl}
          size={96}
          fallback={displayName || username}
        />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-display-md text-ink">
              {displayName || username}
              <span className="italic">.</span>
            </h1>
            {isPrivate && (
              <span className="border border-rule px-2 py-1 font-mono text-meta-sm uppercase text-ink-muted">
                Private
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-meta-sm uppercase text-ink-muted">
            @{username}
          </p>
          {bio && (
            <p className="mt-5 max-w-prose font-body text-reading text-ink-soft">
              {bio}
            </p>
          )}
          {isOwner && (
            <div className="mt-6">
              <Link
                href="/settings"
                className={buttonClassName("secondary", "sm")}
              >
                Edit profile
              </Link>
            </div>
          )}
        </div>
      </div>

      {lenses.length > 0 && (
        <section className="mt-12 border-t border-rule pt-10">
          <p className="font-mono text-meta-sm uppercase text-ink-muted">
            Signature lenses
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {lenses.map((lens) => (
              <li
                key={lens}
                className="border border-rule px-3 py-1 font-mono text-meta-sm uppercase text-ink"
              >
                {lens}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 border-t border-rule pt-10">
        <p className="font-mono text-meta-sm uppercase text-ink-muted">
          Journals
        </p>
        <p className="mt-4 font-body text-reading text-ink-soft">
          {isOwner
            ? "You haven't written anything yet. That's the next slice."
            : "Nothing published yet."}
        </p>
      </section>
    </div>
  );
}

function PrivateShell({ username }: { username: string }) {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <Avatar src={null} size={96} fallback={username} className="mx-auto" />
      <h1 className="mt-6 font-display text-display-md text-ink">
        @{username}
        <span className="italic">.</span>
      </h1>
      <p className="mt-2 font-mono text-meta-sm uppercase text-ink-muted">
        Private profile
      </p>
      <p className="mt-6 font-body text-reading text-ink-soft">
        Journals here are only visible to the writer.
      </p>
    </div>
  );
}
