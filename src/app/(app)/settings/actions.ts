"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settingsSchema } from "@/lib/validation/profile";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { sniffImageType, SNIFF_BYTES } from "@/lib/image-sniff";
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

const AVATAR_BUCKET = "avatars";
// Mirrored by the bucket's file_size_limit (0010_avatar_guards.sql).
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
// Each upload is a storage write plus a delete sweep.
const RATE_AVATAR = { max: 10, windowMs: 60 * 60_000 };

export async function updateSettingsAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse({
    username: formData.get("username"),
    display_name: formData.get("display_name"),
    bio: formData.get("bio") ?? undefined,
    signature_lenses: formData.getAll("signature_lenses"),
    is_private: formData.get("is_private") === "on",
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
      username: parsed.data.username,
      display_name: parsed.data.display_name,
      bio,
      signature_lenses: lenses,
      is_private: parsed.data.is_private,
    })
    .eq("id", user.id);

  if (error) {
    // Postgres unique_violation — the UNIQUE constraint on username is the
    // authoritative race-free check.
    if (error.code === "23505") {
      return {
        ok: false,
        error: "That username is taken — try another.",
        fieldErrors: { username: "Taken." },
      };
    }
    return { ok: false, error: error.message };
  }

  // Profile pages read the profile server-side, so bust their cache too.
  revalidatePath("/settings");
  revalidatePath(`/${parsed.data.username}`);

  return { ok: true };
}

// Avatar upload. The order matters:
//   1. Sniff the real type from the bytes (src/lib/image-sniff.ts). The
//      browser's File.type is never trusted for what we store or serve.
//   2. Upload under avatars/<uid>/ with the user's client, so storage RLS
//      still confines them to their own folder.
//   3. Point profiles.avatar_url at it via the service role. 0010 removed
//      the browser role's grant on avatar_url, so arbitrary URLs can't be
//      written directly.
//   4. Only then delete the previous file(s): a failure before this point
//      leaves the old avatar intact instead of a broken image.
export async function uploadAvatarAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file provided." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Image must be under 5 MB." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to sign in again." };
  }

  const limit = await checkRateLimit(`avatar:${user.id}`, RATE_AVATAR);
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit) };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImageType(bytes.subarray(0, SNIFF_BYTES));
  if (!kind) {
    return { ok: false, error: "Use a JPG, PNG, or WebP image." };
  }

  // Folder prefix = auth.uid() is what the storage RLS policy enforces, so
  // this path is what keeps users from writing into each other's folders.
  const fileName = `${Date.now()}.${kind.ext}`;
  const path = `${user.id}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, {
      cacheControl: "3600",
      upsert: false,
      contentType: kind.mime,
    });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { error: updateError } = await createAdminClient()
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (updateError) {
    // Don't leave an orphan the profile never pointed at.
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return { ok: false, error: updateError.message };
  }

  // Sweep everything else in the folder, not just the previous avatar_url:
  // that also cleans up orphans from uploads that failed before this fix.
  const { data: existing, error: listError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .list(user.id, { limit: 100 });
  const stale = (existing ?? [])
    .map((o) => o.name)
    .filter((name) => name !== fileName)
    .map((name) => `${user.id}/${name}`);
  if (listError) {
    console.error("avatar cleanup: list failed:", listError);
  } else if (stale.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove(stale);
    if (removeError) console.error("avatar cleanup: remove failed:", removeError);
  }

  revalidatePath("/settings");

  return { ok: true, data: { url: publicUrl } };
}
