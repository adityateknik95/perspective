"use server";

import { createClient } from "@/lib/supabase/server";
import { reportSchema, type ReportInput } from "@/lib/validation/social";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { isPermissionDenied } from "@/lib/supabase/errors";
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

// Reports are cheap to file and expensive to review, so they're limited.
const RATE_REPORT = { max: 10, windowMs: 60 * 60_000 };

// File a report against a perspective or response.
//
// The database does the real gatekeeping (reports_insert_self, 0012): you
// can only report something you can currently see, and only the content
// columns are writable, so a report can't be filed pre-resolved. A repeat
// report of the same target by the same person hits the unique index and
// is treated as success — the outcome the reporter wanted already exists.
export async function reportAction(
  values: ReportInput,
): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check your report.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to report." };

  const limit = await checkRateLimit(`report:${user.id}`, RATE_REPORT);
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit) };

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
  });

  if (error?.code === "23505") return { ok: true };
  if (isPermissionDenied(error)) {
    return { ok: false, error: "This can't be reported." };
  }
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
