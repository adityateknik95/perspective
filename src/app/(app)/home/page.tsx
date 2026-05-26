import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { HomeTabs, type HomeTab } from "./tabs";
import { FilmsTab } from "./films-tab";
import { FollowingTab } from "./following-tab";
import { WritingTab } from "./writing-tab";

export const metadata: Metadata = {
  title: "Home",
};

interface PageProps {
  searchParams: { tab?: string };
}

const VALID_TABS: ReadonlyArray<HomeTab> = ["films", "following", "writing"];

function parseTab(raw: string | undefined): HomeTab {
  if (raw && (VALID_TABS as readonly string[]).includes(raw)) {
    return raw as HomeTab;
  }
  return "films";
}

// Logged-in home. Three tabs:
//   - films     (TMDB now playing, trending, anniversaries) — default
//   - following (perspectives from people the viewer follows)
//   - writing   (drafts + today's prompt + start a new perspective)
//
// Tab state lives in the URL via ?tab=…, so each tab is bookmarkable and
// the back button works.
//
// Onboarding-incomplete users get bounced. Signed-out users would only
// reach this page by typing the URL — middleware doesn't gate it but the
// queries below need a viewer id, so we redirect to /login in that case.
export default async function HomePage({ searchParams }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/home");

  // Onboarding gate — same shape as /page.tsx's redirect. If the user
  // hasn't picked a display name + signature lenses, send them through
  // onboarding before landing on the home surface.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, signature_lenses")
    .eq("id", user.id)
    .maybeSingle();

  const onboarded =
    profile &&
    !!profile.display_name &&
    (profile.signature_lenses ?? []).length > 0;
  if (!onboarded) redirect("/onboarding");

  const active = parseTab(searchParams.tab);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-10">
        <p className="font-mono text-meta-sm uppercase tracking-[0.15em] text-ink-muted">
          {today()}
        </p>
        <h1 className="mt-3 font-display text-display-md text-ink sm:text-display-lg">
          Good to see you<span className="italic">.</span>
        </h1>
      </header>

      <HomeTabs active={active} />

      <div className="mt-10">
        {active === "films" && <FilmsTab />}
        {active === "following" && <FollowingTab viewerId={user.id} />}
        {active === "writing" && <WritingTab viewerId={user.id} />}
      </div>
    </div>
  );
}

// "Tuesday, May 26" — date masthead above the greeting. Uses the server's
// locale rather than the viewer's; close enough for v1, and avoids a
// hydration mismatch from rendering different strings on server vs client.
function today(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
