import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Lens } from "@/lib/lenses";
import { isLens } from "@/lib/lenses";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "username, display_name, bio, avatar_url, signature_lenses, is_private",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // Profile row is created by the auth trigger; if it's missing, something
    // went wrong — push through onboarding rather than break here.
    redirect("/onboarding");
  }

  const signatureLenses = (profile.signature_lenses ?? []).filter(
    (l): l is Lens => isLens(l),
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-10">
        <p className="font-mono text-meta-sm uppercase text-ink-muted">
          Your account
        </p>
        <h1 className="mt-3 font-display text-display-lg text-ink">
          Settings<span className="italic">.</span>
        </h1>
      </div>
      <SettingsForm
        initial={{
          username: profile.username,
          display_name: profile.display_name ?? "",
          bio: profile.bio ?? undefined,
          signature_lenses: signatureLenses,
          is_private: profile.is_private ?? false,
          avatar_url: profile.avatar_url,
        }}
      />
    </div>
  );
}
