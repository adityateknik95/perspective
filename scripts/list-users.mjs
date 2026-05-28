// One-off diagnostic — lists all users in the Supabase auth.users table
// directly, bypassing the dashboard's caching. Reads .env.local manually
// so we don't need dotenv as a dependency.
//
// Usage from project root: node scripts/list-users.mjs

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Tiny .env parser — just splits on '=' and strips quotes. Doesn't handle
// every edge case dotenv does, but it's enough for our flat KEY=VALUE file.
const env = {};
try {
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
} catch (e) {
  console.error("Could not read .env.local:", e.message);
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

console.log("Project:", url);
console.log("");

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// listUsers paginates — page 1, 1000 per page is fine for this scale.
const { data, error } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

if (error) {
  console.error("listUsers failed:", error.message);
  process.exit(1);
}

console.log(`Total users: ${data.users.length}\n`);

// Sort by created_at descending so newest signups appear at the top.
const sorted = [...data.users].sort(
  (a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
);

for (const u of sorted) {
  const confirmed = u.email_confirmed_at ? "✓ confirmed" : "✗ unconfirmed";
  const date = new Date(u.created_at).toLocaleString();
  console.log(`  ${u.email}`);
  console.log(`    ${confirmed}  ·  ${date}  ·  ${u.id}`);
}
