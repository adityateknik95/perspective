import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminUserIds } from "@/lib/env";

// Admins are an env-var list of auth user ids (ADMIN_USER_IDS). Deliberately
// not a database role: the list is managed at deploy time, needs no
// migration to change, and can't be granted by anything a user can write.
// The flip side is that the database can't see it, so admin writes go
// through the service role after requireAdmin() — see admin/reports/actions.

export function isAdmin(userId: string | null | undefined): boolean {
  return !!userId && adminUserIds().has(userId.toLowerCase());
}

// For admin pages and actions. Non-admins (and signed-out visitors) get a
// plain 404, so the admin surface doesn't advertise itself.
export async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.id)) notFound();
  return { userId: user.id };
}
