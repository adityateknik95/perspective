"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

// Password guessing. Two keys because each closes the other's gap:
//   per IP    — one client trying many accounts
//   per email — many clients (a botnet) trying one account
// The per-email limit means a hostile client can lock a user out of
// password sign-in for up to 15 minutes; they can still reset their
// password or use Google. That trade is the standard one.
const RATE_IP = { max: 20, windowMs: 15 * 60_000 };
const RATE_EMAIL = { max: 10, windowMs: 15 * 60_000 };
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

  const email = parsed.data.email.toLowerCase();
  for (const [key, rate] of [
    [`login:ip:${clientIp(headers())}`, RATE_IP],
    [`login:email:${email}`, RATE_EMAIL],
  ] as const) {
    const limit = await checkRateLimit(key, rate);
    if (!limit.ok) return { ok: false, error: rateLimitMessage(limit) };
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
