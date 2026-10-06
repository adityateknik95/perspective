"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

// Reset emails go to someone's inbox: limit per address so nobody can be
// mail-bombed, and per IP so one client can't walk a list of addresses.
// The email limit applies whether or not the account exists, so hitting it
// reveals nothing about which emails are registered.
const RATE_EMAIL = { max: 3, windowMs: 60 * 60_000 };
const RATE_IP = { max: 10, windowMs: 60 * 60_000 };
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

export async function forgotPasswordAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please enter a valid email.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const email = parsed.data.email.toLowerCase();
  for (const [key, rate] of [
    [`reset:ip:${clientIp(headers())}`, RATE_IP],
    [`reset:email:${email}`, RATE_EMAIL],
  ] as const) {
    const limit = await checkRateLimit(key, rate);
    if (!limit.ok) return { ok: false, error: rateLimitMessage(limit) };
  }

  const supabase = createClient();
  const origin =
    headers().get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // Do not differentiate between existing and unknown emails — otherwise this
  // endpoint becomes a user-enumeration oracle. Always report success.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return { ok: true };
}
