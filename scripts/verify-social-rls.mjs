// Smoke-test the RLS + triggers + RPCs created by 0004_social.sql.
//
// Usage:
//   node --env-file=.env.local scripts/verify-social-rls.mjs
//
// Required env:
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY
//
// Creates two throwaway users (rlstesta_<ts>@perspective-test.local etc),
// runs 14 checks against the social schema, then deletes them. Idempotent —
// previous test users get cleaned up at the start. Test fixtures (the
// throwaway film, perspective, reactions, follows, notifications) cascade
// out when the test users are deleted.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error(
    "Missing one of NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon = createClient(URL, ANON, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function asUser(jwt) {
  return createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

// --- Test bookkeeping ---------------------------------------------------------

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`  ${tag}  ${name}${detail ? " — " + detail : ""}`);
}

// --- Setup --------------------------------------------------------------------

console.log("Cleaning up any leftover test users...");
{
  // Paginate auth.users; delete anything from a previous run.
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) {
    console.error("Could not list users:", error);
    process.exit(1);
  }
  for (const u of data?.users ?? []) {
    if (u.email?.endsWith("@perspective-test.local")) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

const ts = Math.floor(Date.now() / 1000) % 1_000_000;
const aEmail = `rlstesta_${ts}@perspective-test.local`;
const bEmail = `rlstestb_${ts}@perspective-test.local`;
const aUsername = `rlstesta${ts}`.slice(0, 20);
const bUsername = `rlstestb${ts}`.slice(0, 20);
const password = `TestPass!${ts}xyz`;

console.log("Creating test users A and B...");
const { data: aUser, error: aErr } = await admin.auth.admin.createUser({
  email: aEmail,
  password,
  email_confirm: true,
  user_metadata: { username: aUsername, full_name: "RLS Test A" },
});
if (aErr) {
  console.error("createUser A failed:", aErr);
  process.exit(1);
}

const { data: bUser, error: bErr } = await admin.auth.admin.createUser({
  email: bEmail,
  password,
  email_confirm: true,
  user_metadata: { username: bUsername, full_name: "RLS Test B" },
});
if (bErr) {
  console.error("createUser B failed:", bErr);
  process.exit(1);
}

const aId = aUser.user.id;
const bId = bUser.user.id;
console.log(`  A: ${aId}  (${aUsername})`);
console.log(`  B: ${bId}  (${bUsername})`);

// Verify the profile-auto-create trigger ran.
{
  const { data: profs, error } = await admin
    .from("profiles")
    .select("id, username")
    .in("id", [aId, bId]);
  if (error || !profs || profs.length !== 2) {
    console.error(
      "Profile auto-create trigger didn't fire. Got:",
      profs,
      error,
    );
    process.exit(1);
  }
}

console.log("Signing in to mint JWTs...");
const { data: aSess, error: aSessErr } = await anon.auth.signInWithPassword({
  email: aEmail,
  password,
});
if (aSessErr) {
  console.error("signIn A failed:", aSessErr);
  process.exit(1);
}
const { data: bSess, error: bSessErr } = await anon.auth.signInWithPassword({
  email: bEmail,
  password,
});
if (bSessErr) {
  console.error("signIn B failed:", bSessErr);
  process.exit(1);
}

const A = asUser(aSess.session.access_token);
const B = asUser(bSess.session.access_token);

console.log("Seeding test film + perspective (authored by A)...");
const { data: film, error: filmErr } = await admin
  .from("films")
  .upsert(
    {
      tmdb_id: 999999, // sentinel — not a real TMDB id
      title: "RLS Test Film",
      year: 2024,
    },
    { onConflict: "tmdb_id" },
  )
  .select("id")
  .single();
if (filmErr) {
  console.error("film upsert failed:", filmErr);
  process.exit(1);
}

const { data: persp, error: perspErr } = await admin
  .from("perspectives")
  .insert({
    user_id: aId,
    film_id: film.id,
    title: "Test perspective for RLS smoke",
    body: "<p>This is a test.</p>",
    body_plaintext: "This is a test.",
    word_count: 4,
    reading_time_minutes: 1,
    lens_tags: ["memory"],
    is_draft: false,
    is_private: false,
    published_at: new Date().toISOString(),
  })
  .select("id")
  .single();
if (perspErr) {
  console.error("perspective insert failed:", perspErr);
  process.exit(1);
}
const perspectiveId = persp.id;
console.log(`  perspective: ${perspectiveId}`);

// --- Checks -------------------------------------------------------------------

console.log("\nRunning RLS smoke test...");

// 1. A inserts own reaction — allowed.
{
  const { error } = await A.from("reactions").insert({
    user_id: aId,
    perspective_id: perspectiveId,
    reaction_type: "moved",
  });
  check("A inserts own reaction", !error, error?.message);
}

// 2. A inserts reaction with user_id=B — blocked by RLS.
{
  const { error } = await A.from("reactions").insert({
    user_id: bId,
    perspective_id: perspectiveId,
    reaction_type: "moved",
  });
  check(
    "A cannot insert reaction with B as user_id",
    !!error,
    error ? `blocked (${error.code})` : "UNEXPECTEDLY ALLOWED",
  );
}

// 3. anon SELECT reactions — allowed (public).
{
  const { data, error } = await anon
    .from("reactions")
    .select("id")
    .eq("perspective_id", perspectiveId);
  check(
    "anon can SELECT reactions",
    !error && (data?.length ?? 0) > 0,
    error?.message ?? `${data?.length ?? 0} rows`,
  );
}

// Setup for next checks: have B react to A's perspective so A gets a
// notification (the trigger skips self-reactions).
{
  const { error } = await B.from("reactions").insert({
    user_id: bId,
    perspective_id: perspectiveId,
    reaction_type: "changed_my_mind",
  });
  if (error) console.log("  (setup) B reaction failed:", error.message);
}

// 4. B SELECT notifications WHERE user_id=A — returns 0 (RLS hides).
{
  const { data, error } = await B.from("notifications")
    .select("id")
    .eq("user_id", aId);
  check(
    "B cannot read A's notifications",
    !error && (data?.length ?? 0) === 0,
    error?.message ?? `${data?.length ?? 0} rows`,
  );
}

// 5. A SELECT own notifications — at least 1 (B's reaction).
{
  const { data, error } = await A.from("notifications")
    .select("id, type, actor_id")
    .eq("user_id", aId);
  const ok =
    !error &&
    data?.length >= 1 &&
    data.some((n) => n.type === "reaction" && n.actor_id === bId);
  check(
    "A reads own notifications (B's reaction visible)",
    ok,
    error?.message ?? `${data?.length ?? 0} rows`,
  );
}

// 6. A INSERT into notifications — blocked (no INSERT policy at all).
{
  const { error } = await A.from("notifications").insert({
    user_id: aId,
    actor_id: bId,
    type: "follow",
  });
  check(
    "A cannot INSERT notifications directly",
    !!error,
    error ? error.code : "UNEXPECTEDLY ALLOWED",
  );
}

// 7. A INSERT follows(A,A) — blocked by CHECK constraint, not RLS.
{
  const { error } = await A.from("follows").insert({
    follower_id: aId,
    following_id: aId,
  });
  check(
    "A cannot self-follow (CHECK constraint)",
    !!error,
    error ? error.code : "UNEXPECTEDLY ALLOWED",
  );
}

// 8. A INSERT follows(A,B) — allowed; B should get a follow notification.
{
  const { error } = await A.from("follows").insert({
    follower_id: aId,
    following_id: bId,
  });
  check("A follows B (insert)", !error, error?.message);

  // Verify the trigger fired.
  const { data } = await admin
    .from("notifications")
    .select("id, type, actor_id")
    .eq("user_id", bId)
    .eq("type", "follow")
    .eq("actor_id", aId);
  check(
    "B got follow notification (trigger fired)",
    data?.length === 1,
    `${data?.length ?? 0} rows`,
  );
}

// 9. A INSERT same follow row again — blocked by PK conflict.
{
  const { error } = await A.from("follows").insert({
    follower_id: aId,
    following_id: bId,
  });
  check(
    "A cannot duplicate follow row",
    !!error,
    error ? error.code : "UNEXPECTEDLY ALLOWED",
  );
}

// 10. A DELETE the follow, mark notification read, INSERT again.
//     Expect: same notification row, created_at bumped, read_at cleared.
{
  const { data: before } = await admin
    .from("notifications")
    .select("id, created_at, read_at")
    .eq("user_id", bId)
    .eq("type", "follow")
    .single();

  // Mark it read so we can detect the trigger clearing it.
  await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", before.id);

  await A.from("follows")
    .delete()
    .eq("follower_id", aId)
    .eq("following_id", bId);

  // Force a measurable timestamp gap so created_at clearly moves.
  await new Promise((r) => setTimeout(r, 1100));

  await A.from("follows").insert({ follower_id: aId, following_id: bId });

  const { data: after } = await admin
    .from("notifications")
    .select("id, created_at, read_at")
    .eq("user_id", bId)
    .eq("type", "follow")
    .single();

  const sameRow = after?.id === before?.id;
  const bumped =
    after && new Date(after.created_at) > new Date(before.created_at);
  const readCleared = after?.read_at === null;
  check(
    "follow notification dedupes + bumps timestamp + clears read_at",
    sameRow && bumped && readCleared,
    `same=${sameRow} bumped=${bumped} read-cleared=${readCleared}`,
  );
}

// 11. A INSERT into reports — allowed.
{
  const { error } = await A.from("reports").insert({
    reporter_id: aId,
    target_type: "perspective",
    target_id: perspectiveId,
    reason: "rls smoke test",
  });
  check("A can insert report", !error, error?.message);
}

// 12. A SELECT from reports — returns 0 (no SELECT policy).
{
  const { data, error } = await A.from("reports").select("id");
  check(
    "A cannot read reports back",
    !error && (data?.length ?? 0) === 0,
    error?.message ?? `${data?.length ?? 0} rows`,
  );
}

// 13. RPC: get_perspective_reaction_summary.
{
  const { data, error } = await A.rpc("get_perspective_reaction_summary", {
    p_perspective_id: perspectiveId,
  });
  const required = [
    "moved",
    "changed_my_mind",
    "recognized_myself",
    "saw_it_differently",
    "stayed_with_me",
    "total",
  ];
  const hasAll = data && required.every((k) => k in data);
  const totalLooksRight = data && data.total === 2; // moved + changed_my_mind
  check(
    "reaction summary RPC returns full jsonb",
    !error && hasAll && totalLooksRight,
    error?.message ?? JSON.stringify(data),
  );
}

// 14. RPC: get_feed_for_user. B follows A; A's perspective should appear.
{
  await B.from("follows").insert({ follower_id: bId, following_id: aId });

  const { data, error } = await B.rpc("get_feed_for_user", {
    p_user_id: bId,
    p_cursor_published_at: null,
    p_cursor_id: null,
    p_page_size: 20,
  });

  const row = data?.find((r) => r.id === perspectiveId);
  const hasReactionSummary =
    row?.reaction_summary && "moved" in row.reaction_summary;
  const hasResponseCount = typeof row?.response_count === "number";
  const hasAuthor = row?.author_username === aUsername;

  check(
    "feed RPC returns followed perspective + summary + count + author",
    !error && !!row && hasReactionSummary && hasResponseCount && hasAuthor,
    error?.message ??
      `row=${!!row} summary=${hasReactionSummary} count=${hasResponseCount} author=${hasAuthor}`,
  );
}

// --- Cleanup -------------------------------------------------------------------

console.log("\nCleaning up...");
// Delete perspective first so the FK-restrict on films doesn't bite.
await admin.from("perspectives").delete().eq("id", perspectiveId);
await admin.from("films").delete().eq("tmdb_id", 999999);
await admin.auth.admin.deleteUser(aId);
await admin.auth.admin.deleteUser(bId);

// --- Summary -------------------------------------------------------------------

const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;

console.log(`\n${passed}/${results.length} checks passed`);

if (failed > 0) {
  console.log("\nFAILED:");
  for (const r of results.filter((x) => !x.pass)) {
    console.log(`  - ${r.name}${r.detail ? " — " + r.detail : ""}`);
  }
  process.exit(1);
}

console.log("\nGREEN.");
