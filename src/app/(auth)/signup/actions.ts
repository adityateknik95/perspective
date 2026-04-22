"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/validation/auth";
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

export async function signupAction(
  formData: FormData,
): Promise<ActionResult<{ email: string }>> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    username: formData.get("username"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = createClient();
  const origin =
    headers().get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
      data: { username: parsed.data.username },
    },
  });

  if (error) {
    const message = error.message.toLowerCase();

    if (message.includes("already registered") || message.includes("user already")) {
      return {
        ok: false,
        error: "That email already has an account.",
        fieldErrors: { email: "Already registered." },
      };
    }

    // Unique violation on profiles.username surfaces because the trigger
    // runs inside the signUp transaction.
    if (
      message.includes("profiles_username") ||
      message.includes("duplicate key") ||
      (message.includes("username") && message.includes("unique"))
    ) {
      return {
        ok: false,
        error: "That username was just taken.",
        fieldErrors: { username: "Taken — try another." },
      };
    }

    return { ok: false, error: error.message };
  }

  return { ok: true, data: { email: parsed.data.email } };
}
