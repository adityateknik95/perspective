import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/logo";
import { buttonClassName } from "@/components/ui/button";
import { AvatarMenu } from "./avatar-menu";

// Server component — reads the session from cookies on every render. The
// avatar menu is split out as its own client component for interactivity.
export async function AppHeader() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    profile = data ?? null;
  }

  return (
    <header className="border-b border-rule bg-cream">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
        >
          <Logo className="text-display-sm" />
        </Link>

        <nav className="flex items-center gap-3">
          {profile ? (
            <AvatarMenu
              username={profile.username}
              displayName={profile.display_name}
              avatarUrl={profile.avatar_url}
            />
          ) : (
            <>
              <Link
                href="/login"
                className="font-mono text-meta-sm uppercase text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className={buttonClassName("primary", "sm")}
              >
                Start writing
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
