"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

export async function loginAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: "Wrong email or password." };
  }

  // If the user arrived at /login from a protected route, honour that
  // destination. Otherwise pick a sensible default based on onboarding state.
  // "/" counts as no preference, so it falls through to the onboarding-
  // aware default below.
  const safeNext = safeNextPath(formData.get("next"));
  const explicitNext = safeNext && safeNext !== "/" ? safeNext : null;

  if (explicitNext) redirect(explicitNext);

  const userId = signInData.user?.id;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, signature_lenses")
      .eq("id", userId)
      .maybeSingle();

    const onboarded =
      profile &&
      !!profile.display_name &&
      (profile.signature_lenses ?? []).length > 0;

    redirect(onboarded && profile ? `/${profile.username}` : "/onboarding");
  }

  redirect("/");
}
