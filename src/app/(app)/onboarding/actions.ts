"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema } from "@/lib/validation/profile";
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

export async function completeOnboardingAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse({
    display_name: formData.get("display_name"),
    bio: formData.get("bio") ?? undefined,
    // Lenses come in as repeated form fields.
    signature_lenses: formData.getAll("signature_lenses"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to sign in again." };
  }

  const bio = parsed.data.bio && parsed.data.bio.length > 0 ? parsed.data.bio : null;
  const lenses = Array.from(new Set(parsed.data.signature_lenses));

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      bio,
      signature_lenses: lenses,
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  // Send the new user to their own profile so the onboarding feels resolved.
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  redirect(profile?.username ? `/${profile.username}` : "/");
}
