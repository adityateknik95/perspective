"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/validation/auth";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

// Every signup sends a verification email from our Supabase project, and
// Supabase rate-limits outbound auth email per project — a script hammering
// signup would block real users' verification mail. Per IP, per hour.
const RATE_SIGNUP = { max: 5, windowMs: 60 * 60_000 };
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

  const limit = await checkRateLimit(
    `signup:ip:${clientIp(headers())}`,
    RATE_SIGNUP,
  );
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit) };

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
