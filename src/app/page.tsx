import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Perspective — a journal for film, not a review site",
  description:
    "A place to write about films the way you actually talk about them — through grief, memory, denial, craft. Filed by lens, never by star.",
};

export default async function Home() {
  // If you're signed in, the landing page isn't for you — jump to your
  // profile (or onboarding if you haven't finished it yet).
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, signature_lenses")
      .eq("id", user.id)
      .maybeSingle();

    const onboarded =
      profile &&
      !!profile.display_name &&
      (profile.signature_lenses ?? []).length > 0;

    redirect(onboarded && profile ? `/${profile.username}` : "/onboarding");
  }

  return <LandingPage />;
}
