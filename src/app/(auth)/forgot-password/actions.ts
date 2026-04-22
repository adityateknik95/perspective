"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/lib/validation/auth";
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
