"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/moderation/admin";
import {
  moderationTargetSchema,
  type ModerationTarget,
} from "@/lib/validation/moderation";
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

// Moderation actions. Every one starts with requireAdmin(), which 404s for
// anyone not in ADMIN_USER_IDS, and only then uses the service role —
// hidden_at / report status aren't writable by the browser role at all
// (0012), so this is the only way they change.

const TABLE = { perspective: "perspectives", response: "responses" } as const;

function parse(values: ModerationTarget) {
  return moderationTargetSchema.safeParse(values);
}

async function resolveReports(
  target: ModerationTarget,
  status: "actioned" | "dismissed",
  adminId: string,
) {
  return createAdminClient()
    .from("reports")
    .update({ status, resolved_at: new Date().toISOString(), resolved_by: adminId })
    .eq("target_type", target.targetType)
    .eq("target_id", target.targetId)
    .eq("status", "open");
}

async function revalidateTarget(target: ModerationTarget) {
  revalidatePath("/admin/reports");
  if (target.targetType === "perspective") {
    revalidatePath(`/perspective/${target.targetId}`);
    return;
  }
  const { data } = await createAdminClient()
    .from("responses")
    .select("perspective_id")
    .eq("id", target.targetId)
    .maybeSingle();
  if (data) revalidatePath(`/perspective/${data.perspective_id}`);
}

async function setHidden(
  values: ModerationTarget,
  hidden: boolean,
): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  const parsed = parse(values);
  if (!parsed.success) {
    return { ok: false, error: "Invalid target.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { data, error } = await createAdminClient()
    .from(TABLE[parsed.data.targetType])
    .update(
      hidden
        ? { hidden_at: new Date().toISOString(), hidden_by: userId }
        : { hidden_at: null, hidden_by: null },
    )
    .eq("id", parsed.data.targetId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Content no longer exists." };

  if (hidden) {
    const { error: reportErr } = await resolveReports(parsed.data, "actioned", userId);
    if (reportErr) return { ok: false, error: reportErr.message };
  }

  await revalidateTarget(parsed.data);
  return { ok: true };
}

// Hide the content and close every open report against it.
export async function hideContentAction(values: ModerationTarget): Promise<ActionResult> {
  return setHidden(values, true);
}

// Reverse a hide. Reports stay resolved; a new report reopens the case.
export async function unhideContentAction(values: ModerationTarget): Promise<ActionResult> {
  return setHidden(values, false);
}

// Close every open report against a target without touching the content.
export async function dismissReportsAction(values: ModerationTarget): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  const parsed = parse(values);
  if (!parsed.success) {
    return { ok: false, error: "Invalid target.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const { error } = await resolveReports(parsed.data, "dismissed", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/reports");
  return { ok: true };
}
