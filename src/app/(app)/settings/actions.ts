"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validation/profile";
import {
  fieldErrorsFromZod,
  type ActionResult,
} from "@/lib/action-result";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

export async function uploadAvatarAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided." };
  }
  if (file.size === 0) {
    return { ok: false, error: "No file provided." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Image must be under 5 MB." };
  }
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return { ok: false, error: "Use a JPG, PNG, or WebP image." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to sign in again." };
  }

  // Folder prefix = auth.uid() is what the storage RLS policy enforces, so
  // this path is what keeps users from writing into each other's folders.
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/settings");

  return { ok: true, data: { url: publicUrl } };
}
