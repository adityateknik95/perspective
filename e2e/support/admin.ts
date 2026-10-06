import { createClient } from "@supabase/supabase-js";

// Service-role helpers for the e2e suite. Used only for what a browser
// can't do on its own: confirming a sign-up email (real projects require
// it), seeding the film row, and cleaning up afterwards. Every product
// action in the specs goes through the UI.

export const E2E_EMAIL_DOMAIN = "e2e.perspective-test.local";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for the e2e suite (see playwright.config.ts).`);
  return v;
}

export const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`.slice(-10);
}

async function findUserByEmail(email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

// Stand-in for clicking the link in the verification email.
export async function confirmEmail(email: string): Promise<string> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`No auth user for ${email}`);
  const { error } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
  if (error) throw error;
  return user.id;
}

// A second, already-onboarded account (the reader). Created directly so
// the spec spends its time on the flow under test, not on a second signup.
export async function createOnboardedUser(username: string, displayName: string) {
  const email = `${username}@${E2E_EMAIL_DOMAIN}`;
  const password = `Pw-${uniqueSuffix()}-e2e!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) throw error;
  await admin
    .from("profiles")
    .update({ display_name: displayName, signature_lenses: ["memory"] })
    .eq("id", data.user.id);
  return { id: data.user.id, email, password };
}

// A cached film row, so draft creation and the film page never need TMDB.
export async function seedFilm(): Promise<number> {
  const tmdbId = 990_001;
  const { error } = await admin
    .from("films")
    .upsert({ tmdb_id: tmdbId, title: "E2E Test Film", year: 1997 }, { onConflict: "tmdb_id" });
  if (error) throw error;
  return tmdbId;
}

// Delete every account this suite created (cascades take their content).
export async function cleanupUsers(): Promise<void> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email?.endsWith(`@${E2E_EMAIL_DOMAIN}`)) await admin.auth.admin.deleteUser(u.id);
    }
    if (data.users.length < 200) break;
  }
}
