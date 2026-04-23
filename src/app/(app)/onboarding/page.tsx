import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, signature_lenses")
    .eq("id", user.id)
    .maybeSingle();

  // Already onboarded — we treat "has display_name AND at least one lens" as
  // the signal, since username exists from signup.
  if (
    profile &&
    profile.display_name &&
    profile.signature_lenses &&
    profile.signature_lenses.length > 0
  ) {
    redirect(`/${profile.username}`);
  }

  const initialDisplayName =
    profile?.display_name ||
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "") ||
    "";

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <p className="font-mono text-meta-sm uppercase text-ink-muted">
        Welcome to Perspective
      </p>
      <div className="mt-8">
        <OnboardingForm initialDisplayName={initialDisplayName} />
      </div>
    </div>
  );
}
