// Run a SQL file against the linked Supabase project via the Management API.
//
// Usage:
//   node --env-file=.env.local scripts/db-exec.mjs <path-to-sql-file>
//
// Required env:
//   SUPABASE_PAT                — Personal Access Token (sbp_...)
//   NEXT_PUBLIC_SUPABASE_URL    — used to extract the project ref
//
// The Management API runs raw SQL with superuser-equivalent privileges, so
// it can do DDL that the PostgREST + service-role path can't. Idempotent
// migrations (create ... if not exists / drop ... if exists) are safe to
// re-run.

import { readFileSync } from "node:fs";

const PAT = process.env.SUPABASE_PAT;
const URL_VAR = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!PAT) {
  console.error("SUPABASE_PAT is not set in .env.local");
  process.exit(1);
}
if (!URL_VAR) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is not set in .env.local");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/db-exec.mjs <sql-file>");
  process.exit(1);
}

const ref = new URL(URL_VAR).hostname.split(".")[0];
const sql = readFileSync(file, "utf8");

console.log(`Project ref: ${ref}`);
console.log(`SQL bytes:   ${sql.length}`);
console.log(`Endpoint:    https://api.supabase.com/v1/projects/${ref}/database/query`);
console.log("Running...");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);

const text = await res.text();

if (!res.ok) {
  console.error(`\nHTTP ${res.status} ${res.statusText}`);
  console.error(text);
  process.exit(1);
}

console.log(`\nOK (${res.status})`);
// The Management API returns either a result array or [] for DDL.
try {
  const body = JSON.parse(text);
  console.log(JSON.stringify(body, null, 2).slice(0, 800));
} catch {
  console.log(text.slice(0, 800));
}
