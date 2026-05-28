import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { FollowButton } from "@/components/follows/follow-button";
import { isLens } from "@/lib/lenses";

// The shape every place that shows a list of profiles uses — search results,
// followers list, following list. Kept loose intentionally: callers can pass
// extra fields, this just consumes the ones we render.
export interface ProfileRowData {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean;
  signature_lenses: string[];
}

interface ProfileRowProps {
  profile: ProfileRowData;
  isSignedIn: boolean;
  initialFollowing: boolean;
  // Hide the Follow button on the viewer's own row — you can't follow
  // yourself, and self-rows would be confusing in your own followers list.
  isSelf?: boolean;
}

// One row in a list-of-profiles surface. The whole avatar+name region is a
// link to /<username>; the Follow button is a separate flex sibling so its
// clicks don't bubble up and navigate. Bio is truncated at two lines; the
// signature lenses (up to 3) appear as small chips below.
export function ProfileRow({
  profile,
  isSignedIn,
  initialFollowing,
  isSelf = false,
}: ProfileRowProps) {
  const signInHref = `/login?next=${encodeURIComponent(`/${profile.username}`)}`;
  const lenses = profile.signature_lenses.filter(isLens).slice(0, 3);

  return (
    <div className="flex items-start gap-4 py-5">
      <Link
        href={`/${profile.username}`}
        className="flex min-w-0 flex-1 items-start gap-4 hover:opacity-90"
      >
        <Avatar
          src={profile.avatar_url}
          size={48}
          fallback={profile.display_name || profile.username}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="truncate font-display text-reading text-ink">
              {profile.display_name || profile.username}
            </p>
            {profile.is_private && (
              <span className="border border-rule px-1.5 py-0.5 font-mono text-[0.65rem] uppercase text-ink-muted">
                Private
              </span>
            )}
          </div>
          <p className="truncate font-mono text-meta-sm uppercase text-ink-muted">
            @{profile.username}
          </p>
          {profile.bio && (
            <p className="mt-1 line-clamp-2 font-body text-reading-sm text-ink-soft">
              {profile.bio}
            </p>
          )}
          {lenses.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {lenses.map((lens) => (
                <li
                  key={lens}
                  className="border border-rule px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-muted"
                >
                  {lens}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>

      {!isSelf && (
        <div className="shrink-0">
          <FollowButton
            username={profile.username}
            initialFollowing={initialFollowing}
            isSignedIn={isSignedIn}
            signInHref={signInHref}
          />
        </div>
      )}
    </div>
  );
}
