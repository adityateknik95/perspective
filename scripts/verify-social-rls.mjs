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

// Sign-ins go through their own client. signInWithPassword stores the
// session on the client it's called on, so signing in through `anon` would
// silently turn every later "anon" check into a check as the last user.
const signer = createClient(URL, ANON, {
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
const { data: aSess, error: aSessErr } = await signer.auth.signInWithPassword({
  email: aEmail,
  password,
});
if (aSessErr) {
  console.error("signIn A failed:", aSessErr);
  process.exit(1);
}
const { data: bSess, error: bSessErr } = await signer.auth.signInWithPassword({
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

// --- 0006: perspective write guards ----------------------------------------
//
// Every check below calls PostgREST directly with a user's JWT — exactly what
// anyone holding the public anon key can do — so none of it goes through a
// server action. "Denied" means Postgres refused the write (42501 for a
// column privilege), not that the app chose not to send it.

function denied(name, { error }, extra = "") {
  check(name, !!error, error ? `blocked (${error.code})${extra}` : "UNEXPECTEDLY ALLOWED");
}

console.log("\n0006 perspective write guards...");

for (const [col, value] of [
  ["body", "<img src=x onerror=alert(1)>"],
  ["body_plaintext", "forged"],
  ["word_count", 99999],
  ["reading_time_minutes", 999],
  ["is_draft", true],
  ["published_at", "2001-01-01T00:00:00Z"],
  ["title", "retitled after publish"],
  ["lens_tags", ["grief"]],
]) {
  denied(
    `owner A cannot UPDATE perspectives.${col} directly`,
    await A.from("perspectives").update({ [col]: value }).eq("id", perspectiveId).select("id"),
  );
}

{
  const res = await A.from("perspectives")
    .update({ is_private: false })
    .eq("id", perspectiveId)
    .select("id");
  check(
    "owner A can still toggle is_private",
    !res.error && res.data?.length === 1,
    res.error?.message ?? `${res.data?.length} rows`,
  );
}

denied(
  "A cannot INSERT a perspective born published with a body",
  await A.from("perspectives").insert({
    user_id: aId,
    film_id: film.id,
    title: "x",
    body: "<script>alert(1)</script>",
    lens_tags: ["memory"],
    is_draft: false,
    published_at: new Date().toISOString(),
  }),
);

{
  const res = await A.from("perspectives")
    .insert({ user_id: aId, film_id: film.id })
    .select("id, is_draft, body, title")
    .single();
  const ok =
    !res.error && res.data.is_draft === true && res.data.body === "" && res.data.title === "";
  check(
    "A can INSERT an empty draft with only user_id + film_id",
    ok,
    res.error?.message ?? JSON.stringify(res.data),
  );
  if (res.data) await admin.from("perspectives").delete().eq("id", res.data.id);
}

denied(
  "published_at is write-once, even for the service role",
  await admin
    .from("perspectives")
    .update({ published_at: "2001-01-01T00:00:00Z" })
    .eq("id", perspectiveId)
    .select("id"),
);

{
  const res = await admin
    .from("perspectives")
    .update({ body: "<p>server-written</p>", is_draft: true })
    .eq("id", perspectiveId)
    .select("id");
  check(
    "service role (the server writer) can still write body / is_draft",
    !res.error && res.data?.length === 1,
    res.error?.message,
  );
  // Restore published state for the checks that follow.
  await admin
    .from("perspectives")
    .update({ is_draft: false })
    .eq("id", perspectiveId);
}

// --- 0007: profile privacy ---------------------------------------------------

console.log("\n0007 profile privacy...");

// B leaves a response on A's public piece (seeded via admin so this section
// doesn't depend on 0008's insert rules), then both profiles go private.
const { data: bResponse } = await admin
  .from("responses")
  .insert({
    perspective_id: perspectiveId,
    user_id: bId,
    body: "a response from B",
    body_plaintext: "a response from B",
  })
  .select("id")
  .single();

await admin.from("profiles").update({ is_private: true }).in("id", [aId, bId]);

for (const [who, client] of [["anon", anon], ["B", B]]) {
  const { data, error } = await client
    .from("perspectives")
    .select("id")
    .eq("id", perspectiveId);
  check(
    `${who} cannot SELECT a private profile's published perspective`,
    !error && (data?.length ?? 0) === 0,
    error?.message ?? `${data?.length ?? 0} rows`,
  );
}
{
  const { data } = await A.from("perspectives").select("id").eq("id", perspectiveId);
  check("owner A still sees own perspective while private", data?.length === 1);
}
{
  // A is private and has no responses anywhere → no card for anyone else.
  const { data } = await anon.from("profile_cards").select("id").eq("id", aId);
  check(
    "profile_cards does not expose a private profile with no visible responses",
    (data?.length ?? 1) === 0,
    `${data?.length} rows`,
  );
}

// Make A public again so B's response sits on a visible piece.
await admin.from("profiles").update({ is_private: false }).eq("id", aId);
{
  const { data, error } = await anon
    .from("responses")
    .select("id, author:profile_cards!responses_user_id_fkey!inner(username, display_name)")
    .eq("id", bResponse.id);
  const author = data?.[0]?.author;
  check(
    "private B's response on a public piece still shows name (profile_cards)",
    !error && author?.username === bUsername,
    error?.message ?? JSON.stringify(data),
  );
}
{
  const { data } = await anon.from("profiles").select("id").eq("id", bId);
  check(
    "private B's full profile row stays hidden",
    (data?.length ?? 1) === 0,
    `${data?.length} rows`,
  );
}

await admin.from("profiles").update({ is_private: false }).eq("id", bId);
await admin.from("responses").delete().eq("id", bResponse.id);

// --- 0008: social visibility -------------------------------------------------

console.log("\n0008 social visibility...");

// Fixtures, all authored by A and seeded via admin:
//   draftId    — a draft
//   privateId  — published but is_private
//   otherId    — a second public piece (for cross-thread grafting)
async function seedPerspective(extra) {
  const { data, error } = await admin
    .from("perspectives")
    .insert({
      user_id: aId,
      film_id: film.id,
      title: "fixture",
      body: "<p>x</p>",
      body_plaintext: "x",
      lens_tags: ["memory"],
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
const draftId = await seedPerspective({ is_draft: true });
const privateId = await seedPerspective({
  is_draft: false,
  is_private: true,
  published_at: new Date().toISOString(),
});
const otherId = await seedPerspective({
  is_draft: false,
  published_at: new Date().toISOString(),
});
// A second private piece nobody has touched, so the "re-point" check below
// can only fail on RLS, never on the (user, perspective) unique key.
const private2Id = await seedPerspective({
  is_draft: false,
  is_private: true,
  published_at: new Date().toISOString(),
});
const seeded = [draftId, privateId, otherId, private2Id];

// Reactions ------------------------------------------------------------------
denied(
  "B cannot react to A's draft",
  await B.from("reactions").insert({ user_id: bId, perspective_id: draftId, reaction_type: "moved" }),
);
denied(
  "B cannot react to A's private piece",
  await B.from("reactions").insert({ user_id: bId, perspective_id: privateId, reaction_type: "moved" }),
);
{
  const { error } = await A.from("reactions").insert({
    user_id: aId,
    perspective_id: draftId,
    reaction_type: "moved",
  });
  check("owner A can react to own draft", !error, error?.message);
}
{
  // B's existing reaction on the public piece; try to re-point it.
  const { data, error } = await B.from("reactions")
    .update({ perspective_id: private2Id })
    .eq("user_id", bId)
    .eq("perspective_id", perspectiveId)
    .select("id");
  check(
    "B cannot re-point a reaction at a private piece",
    error?.code === "42501" || (!error && (data?.length ?? 0) === 0),
    error ? `${error.code} ${error.message}` : `${data?.length} rows`,
  );
}
{
  await admin
    .from("reactions")
    .insert({ user_id: aId, perspective_id: privateId, reaction_type: "moved" });
  const pub = await anon.from("reactions").select("id").eq("perspective_id", privateId);
  const asB = await B.from("reactions").select("id").eq("perspective_id", privateId);
  const asA = await A.from("reactions").select("id").eq("perspective_id", privateId);
  check(
    "reactions on a private piece are hidden from anon and B, visible to A",
    pub.data?.length === 0 && asB.data?.length === 0 && asA.data?.length === 1,
    `anon=${pub.data?.length} B=${asB.data?.length} A=${asA.data?.length}`,
  );
  const { data: summary } = await B.rpc("get_perspective_reaction_summary", {
    p_perspective_id: privateId,
  });
  check("reaction summary RPC reports 0 on a hidden piece", summary?.total === 0, JSON.stringify(summary));
}
{
  await admin.from("profiles").update({ is_private: true }).eq("id", aId);
  denied(
    "B cannot react to a piece by a now-private profile",
    await B.from("reactions").upsert(
      { user_id: bId, perspective_id: otherId, reaction_type: "moved" },
      { onConflict: "perspective_id,user_id" },
    ),
  );
  await admin.from("profiles").update({ is_private: false }).eq("id", aId);
}

// Responses ------------------------------------------------------------------
const respond = (client, userId, perspective, parent, body = "hello") =>
  client
    .from("responses")
    .insert({
      perspective_id: perspective,
      user_id: userId,
      parent_response_id: parent,
      body,
      body_plaintext: body,
    })
    .select("id")
    .single();

denied("B cannot respond to A's draft", await respond(B, bId, draftId, null));
denied("B cannot respond to A's private piece", await respond(B, bId, privateId, null));

const top = await respond(B, bId, perspectiveId, null, "top-level");
check("B can respond to a public piece", !top.error, top.error?.message);
const otherTop = await respond(B, bId, otherId, null, "top-level elsewhere");

denied(
  "B cannot graft a reply onto a parent from another perspective",
  await respond(B, bId, perspectiveId, otherTop.data.id),
);
const reply = await respond(B, bId, perspectiveId, top.data.id, "a reply");
check("B can reply to a top-level response", !reply.error, reply.error?.message);
denied(
  "B cannot reply to a reply",
  await respond(B, bId, perspectiveId, reply.data.id),
);
denied(
  "B cannot move a response to another perspective",
  await B.from("responses").update({ perspective_id: otherId }).eq("id", top.data.id).select("id"),
);
denied(
  "B cannot forge created_at on insert",
  await B.from("responses").insert({
    perspective_id: perspectiveId,
    user_id: bId,
    body: "x",
    body_plaintext: "x",
    created_at: "2001-01-01T00:00:00Z",
  }),
);

// Resonances -----------------------------------------------------------------
{
  const { data: privResp } = await admin
    .from("responses")
    .insert({ perspective_id: privateId, user_id: aId, body: "p", body_plaintext: "p" })
    .select("id")
    .single();
  denied(
    "B cannot resonate with a response on a private piece",
    await B.from("response_resonances").insert({ response_id: privResp.id, user_id: bId }),
  );
  await admin.from("response_resonances").insert({ response_id: privResp.id, user_id: aId });
  const pub = await anon.from("response_resonances").select("user_id").eq("response_id", privResp.id);
  check(
    "resonances on a private piece's responses are hidden from anon",
    pub.data?.length === 0,
    `${pub.data?.length} rows`,
  );
}
{
  const { error } = await A.from("response_resonances").insert({
    response_id: top.data.id,
    user_id: aId,
  });
  check("A can resonate with a live response on a public piece", !error, error?.message);

  const del = await B.from("responses").update({ is_deleted: true }).eq("id", reply.data.id).select("id");
  check("B can soft-delete own response", !del.error && del.data?.length === 1, del.error?.message);
  denied(
    "A cannot resonate with a soft-deleted response",
    await A.from("response_resonances").insert({ response_id: reply.data.id, user_id: aId }),
  );
}

// Fixture perspectives cascade their reactions / responses / resonances.
await admin.from("perspectives").delete().in("id", seeded);

// --- 0009: feed reads the caller from the JWT --------------------------------

console.log("\n0009 feed RPC...");
{
  // A follows B (from check 8) and B has no pieces; B follows A. If A could
  // pass B's id, A would get B's feed — A's own piece.
  const { error } = await A.rpc("get_feed_for_user", { p_user_id: bId });
  denied("A cannot ask for B's feed by passing p_user_id", { error });

  const { data } = await A.rpc("get_feed_for_user", {});
  check(
    "A's own feed does not contain B's feed (A's own piece)",
    Array.isArray(data) && !data.some((r) => r.id === perspectiveId),
    `${data?.length} rows`,
  );

  denied("anon cannot call get_feed_for_user", await anon.rpc("get_feed_for_user", {}));
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
