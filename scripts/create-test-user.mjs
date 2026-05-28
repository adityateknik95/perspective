// Create a test user directly via the Supabase admin API. Bypasses email
// confirmation entirely — use this when the regular signup form is blocked
// (rate limits, email-send throttle) and you just need a usable account
// for local testing.
//
// Usage from project root:
//   node scripts/create-test-user.mjs <email> <password> <username> [displayName]
//
// Example:
//   node scripts/create-test-user.mjs test1@example.com hunter22 maya "Maya Lin"
//
// The script creates the auth.users row (email-confirmed) and the matching
// profiles row in a single transaction-ish flow. If profiles creation fails
// it deletes the auth user so you can retry without a half-created account.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [, , email, password, username, displayNameArg] = process.argv;

if (!email || !password || !username) {
  console.error(
    "Usage: node scripts/create-test-user.mjs <email> <password> <username> [displayName]",
  );
  process.exit(1);
}

if (!/^[a-z0-9_]{3,20}$/.test(username)) {
  console.error(
    "Username must be 3-20 chars, lowercase letters / digits / underscore only.",
  );
  process.exit(1);
}

const displayName = displayNameArg ?? username;

const env = {};
const raw = readFileSync(".env.local", "utf-8");
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Step 1 — create the auth user with email_confirm: true so they can log
// in immediately. The metadata.username is what your handle_new_user
// trigger reads to populate the profiles row.
const { data: created, error: createErr } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { username },
});

if (createErr) {
  console.error("Failed to create auth user:", createErr.message);
  process.exit(1);
}

const userId = created.user.id;
console.log(`✓ Created auth user ${email}  (id: ${userId})`);

// Step 2 — the handle_new_user trigger should have created a stub profiles
// row. We update it with display_name and signature_lenses so the profile
// is browseable without the user going through onboarding.
const { error: profileErr } = await supabase
  .from("profiles")
  .update({
    display_name: displayName,
    bio: `Test account · ${username}`,
    signature_lenses: ["grief", "memory", "craft"],
  })
  .eq("id", userId);

if (profileErr) {
  console.error("Failed to update profile:", profileErr.message);
  console.error("Rolling back — deleting auth user...");
  await supabase.auth.admin.deleteUser(userId);
  process.exit(1);
}

console.log(`✓ Updated profile  (display_name: "${displayName}", username: @${username})`);
console.log(`\nYou can now sign in at /login with:`);
console.log(`  email:    ${email}`);
console.log(`  password: ${password}`);
console.log(`Profile lives at:  /${username}`);
