// ---------------------------------------------------------------------------
// scripts/seed-demo.mjs
// Seeds the Supabase project with demo content for a portfolio / recruiter
// walkthrough: a handful of authors + readers, real TMDB films (posters and
// metadata), several hand-written perspectives, and a follow / reaction /
// response graph so feeds, profiles, film pages, and notifications all light up.
//
// Idempotent: re-running wipes the demo users' content first, then re-seeds.
//
// Run:  node scripts/seed-demo.mjs
// Needs (read from .env.local): NEXT_PUBLIC_SUPABASE_URL,
//   SUPABASE_SERVICE_ROLE_KEY, TMDB_ACCESS_TOKEN
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sanitizeHtml from "sanitize-html";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- env --------------------------------------------------------------------
function loadEnv() {
  const txt = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}
const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_TOKEN = env.TMDB_ACCESS_TOKEN;
if (!SUPABASE_URL || !SERVICE_KEY || !TMDB_TOKEN) {
  throw new Error("Missing one of NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / TMDB_ACCESS_TOKEN in .env.local");
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- text helpers (mirror src/lib/reading.ts + sanitize-html.ts) ------------
function htmlToPlaintext(html) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function wordCount(pt) {
  const t = pt.trim();
  return t.length === 0 ? 0 : (t.match(/\S+/g) ?? []).length;
}
function readingTime(pt) {
  const w = wordCount(pt);
  return w === 0 ? 0 : Math.max(1, Math.ceil(w / 220));
}

// --- TMDB -------------------------------------------------------------------
async function tmdb(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${path} ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}
const parseYear = (d) => {
  if (!d) return null;
  const y = Number(String(d).slice(0, 4));
  return Number.isFinite(y) && y > 1800 ? y : null;
};
// Resolve {title, year} -> a TMDB film row (verified by year), upsert into films.
async function resolveFilm({ title, year }) {
  const search = await tmdb("/search/movie", { query: title, include_adult: "false", language: "en-US", page: 1 });
  const results = search.results ?? [];
  const match = results.find((r) => parseYear(r.release_date) === year) ?? results[0];
  if (!match) throw new Error(`No TMDB result for "${title}" (${year})`);
  const d = await tmdb(`/movie/${match.id}`, { append_to_response: "credits", language: "en-US" });
  const directors = (d.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name);
  const row = {
    tmdb_id: d.id,
    title: d.title,
    year: parseYear(d.release_date),
    director: directors.length ? directors.join(" & ") : null,
    runtime_minutes: d.runtime || null,
    overview: d.overview || null,
    poster_path: d.poster_path,
    backdrop_path: d.backdrop_path,
    original_language: d.original_language,
  };
  const { data, error } = await admin.from("films").upsert(row, { onConflict: "tmdb_id" }).select("*").single();
  if (error) throw error;
  console.log(`  film: ${data.title} (${data.year})  tmdb=${data.tmdb_id}`);
  return data;
}

// --- demo people ------------------------------------------------------------
const PASSWORD = "Perspective2026!";
const PEOPLE = [
  { key: "mara", username: "mara_okafor", name: "Mara Okafor", email: "mara@example.com",
    bio: "I write about what films leave in the room after they end. Absence, mostly.", lenses: ["grief", "memory", "time"], author: true },
  { key: "theo", username: "theo_lindqvist", name: "Theo Lindqvist", email: "theo@example.com",
    bio: "Editor by trade. I notice cuts, held frames, and the exact second a score decides something for you.", lenses: ["craft", "sound", "place"], author: true },
  { key: "nadia", username: "nadia_rahman", name: "Nadia Rahman", email: "nadia@example.com",
    bio: "Daughter, sister, watcher of slow films about families who don't say the thing.", lenses: ["family", "childhood", "faith"], author: true },
  { key: "sam", username: "sam_vance", name: "Sam Vance", email: "sam@example.com",
    bio: "On the films that keep a person company. Solitude is a genre.", lenses: ["solitude", "longing", "self"], author: true },
  { key: "iris", username: "iris_demarco", name: "Iris DeMarco", email: "iris@example.com",
    bio: "Reader more than writer. Here for the quiet ones.", lenses: ["desire", "language"], author: false },
  { key: "jonah", username: "jonah_ferreira", name: "Jonah Ferreira", email: "jonah@example.com",
    bio: "Projectionist's kid. I trust a film that isn't in a hurry.", lenses: ["place", "work"], author: false },
  { key: "yuki", username: "yuki_tanaka", name: "Yuki Tanaka", email: "yuki@example.com",
    bio: "Watching my way through every film about leaving home.", lenses: ["longing", "memory"], author: false },
];

// --- films ------------------------------------------------------------------
const FILMS = {
  mood: { title: "In the Mood for Love", year: 2000 },
  tokyo: { title: "Tokyo Story", year: 1953 },
  tree: { title: "The Tree of Life", year: 2011 },
  aftersun: { title: "Aftersun", year: 2022 },
  pastlives: { title: "Past Lives", year: 2023 },
  paris: { title: "Paris, Texas", year: 1984 },
  portrait: { title: "Portrait of a Lady on Fire", year: 2019 },
  lost: { title: "Lost in Translation", year: 2003 },
  banshees: { title: "The Banshees of Inisherin", year: 2022 },
};

// --- perspectives -----------------------------------------------------------
// daysAgo controls published_at ordering (larger = older).
const PERSPECTIVES = [
  { author: "mara", film: "aftersun", daysAgo: 3, lenses: ["grief", "memory", "time"],
    title: "The Polaroid Develops Slowly",
    subtitle: "Watching a father you can only reach through a camcorder.",
    body: `<p>The film is built out of footage a daughter took when she was eleven, watched again when she is the age her father was. That is the whole trick of it, and it is not a trick at all. It is just how memory works: you go back with better eyes and worse information.</p>
<p>What undoes me is the Polaroid. He takes it early, and we watch it sit there, blank, the chemicals deciding whether to give the image back. The film never cuts to it resolved. <em>That</em> is the grief — not that he is gone, the film never even confirms he is gone, but that the picture is still developing and she is still standing over it, willing a face to arrive.</p>
<blockquote>You can love someone completely and still only have eleven years of footage.</blockquote>
<p>There's a rave sequence, strobe-lit, where she finally reaches him for a half second at a time. Most films would call that a metaphor and feel clever. This one just lets it hurt. The light gives him back and takes him away on a rhythm she doesn't control. None of us controls it. We get our parents in flashes, at the wrong frame rate, and we spend the rest of our lives in the edit.</p>
<p>I watched it on a Tuesday and called my dad on the Wednesday. That's the only review that matters.</p>` },

  { author: "theo", film: "aftersun", daysAgo: 9, lenses: ["craft", "memory"],
    title: "Shot on the Edge of the Frame",
    subtitle: "How Aftersun hides its father in plain sight.",
    body: `<p>Notice where he is in the compositions. Reflected in a switched-off TV. Caught in a mirror behind her. A shoulder at the edge of the frame while the camcorder hunts for him. Charlotte Wells stages an entire character as something you keep <em>almost</em> seeing.</p>
<p>This is not coyness. It's the grammar of how a child holds a parent: present, central, and somehow never fully in view. The camera is eleven years old. It doesn't know yet what it should have looked at longer.</p>
<h2>The held frame</h2>
<p>There's a shot of an empty paragliding sky that the film simply refuses to cut away from. In the edit suite that's a fight — every instinct says move on. Holding it is the bravest decision in the picture. It makes the absence a physical length of time you have to sit inside. Craft, here, is mostly the courage not to cut.</p>
<p>People talk about this film's ending. I think about its framing. A movie about a memory should be shot like a memory: partial, off-center, lit by whatever light happened to be there.</p>` },

  { author: "mara", film: "pastlives", daysAgo: 14, lenses: ["longing", "time", "grief"],
    title: "In-Yun, or the Arithmetic of Almost",
    subtitle: null,
    body: `<p>The film gives you a word, <em>in-yun</em>: the idea that two people who meet have crossed eight thousand layers of providence to do it. It sounds like romance. By the end it reads more like an accounting of everything that didn't happen.</p>
<p>Nora and Hae Sung get a single day in New York, twenty-four years after a childhood neither chose to leave. The film's discipline is that it never lets them be wrong for each other or right for each other. They are simply <em>late</em>, by a continent and two decades, and being late is its own kind of loss — the loss of a life you were technically alive for and still managed to miss.</p>
<blockquote>It is not the love that hurts. It is the timing, which no amount of love negotiates.</blockquote>
<p>That last shot, the wait for the car, the walk back — Greta Lee does something with her face that is twenty years long. I have watched it three times to figure out the craft of it and I still just end up crying, which I suppose is the answer.</p>` },

  { author: "theo", film: "mood", daysAgo: 19, lenses: ["craft", "longing", "sound"],
    title: "The Music Cue as a Closing Door",
    subtitle: "Wong Kar-wai, Shigeru Umebayashi, and the violin that won't let them.",
    body: `<p>Every time the longing in this film threatens to become an action, Umebayashi's waltz starts, the camera drops into slow motion, and the two of them pass each other on the stairwell like the score is a law of physics they cannot break. <em>Yumeji's Theme.</em> It plays often enough to become a room they live in.</p>
<p>That's the cruelty of the device. The music doesn't accompany their feeling — it <em>governs</em> it. It tells them, and us, that nothing will be done. They will rehearse the confession. They will play-act the confrontation with the spouses we never see. And the strings will keep folding them back into restraint.</p>
<h2>Color as costume</h2>
<p>Maggie Cheung wears a different cheongsam in nearly every scene, and the wallpaper, the curtains, the steam off the noodles — Christopher Doyle shoots it all like a wound that's beautiful enough to keep open. Restraint should feel cold. Here it's the most sensual thing I've ever watched, precisely because it never arrives.</p>
<p>He whispers the secret into a hole in a wall in Angkor Wat and fills it with mud. That's where this kind of love goes. Into the architecture.</p>` },

  { author: "nadia", film: "tree", daysAgo: 24, lenses: ["family", "faith", "childhood"],
    title: "Two Ways Through the World",
    subtitle: "Nature and grace, and a father who only knew one.",
    body: `<p>The film opens by telling you there are two ways through life, the way of nature and the way of grace, and then spends two hours refusing to let you cleanly sort anyone into either. The mother is grace. The father, Brad Pitt with his jaw set against his own kids, wants to be — but was raised by nature and passes it down with his handshake.</p>
<p>I grew up in a house like that. A parent who loved by correcting. Who confused preparing you for a hard world with making the world hard at the dinner table. Malick films it from the floor — low angles, a child's height — so you feel how large a disappointed father is.</p>
<blockquote>Grace doesn't try to please itself. It accepts being slighted. I have watched my mother do this for thirty years.</blockquote>
<p>And then, against everything, the cosmos. Dinosaurs, nebulae, the formation of the earth. People laugh at that swerve. I think it's the only honest scale for a family. What happened at your kitchen table is both nothing against the age of the universe and the entire size of your life. Both are true. The film just has the nerve to hold them in one frame.</p>` },

  { author: "nadia", film: "tokyo", daysAgo: 31, lenses: ["family", "time", "grief"],
    title: "Everyone Is Busy, Everyone Is Kind",
    subtitle: "Ozu and the quiet arithmetic of grown children.",
    body: `<p>An old couple travels to the city to see their grown children, and the children, who are not cruel, simply do not have the time. They book the parents into a spa to be rid of them politely. No one raises their voice. That is the devastation of Ozu: there is no villain, only schedules.</p>
<p>The camera sits at the height of someone kneeling on a tatami mat and almost never moves. People enter, sit, speak in even tones, leave. It trains you to watch the way the film watches — patiently, without judgement, noticing who pours the tea.</p>
<p>It's the widowed daughter-in-law, the one with no blood obligation, who is kind without being busy. That's the knife. The family that owes the most gives the least, and a near-stranger gives everything, and the film does not editorialize. It just shows you the train pulling away and lets you do the math about your own parents.</p>
<blockquote>Isn't life disappointing? Yes, she answers, smiling. It is.</blockquote>
<p>I called my grandmother after. She was busy. I understood, for the first time, that this is exactly the film's point.</p>` },

  { author: "sam", film: "paris", daysAgo: 37, lenses: ["solitude", "longing", "family"],
    title: "A Man Walks Out of the Desert",
    subtitle: null,
    body: `<p>He comes out of the heat with no words left. Travis has walked so far from his own life that he's burned the language off. The first stretch of the film is a man being slowly re-taught how to be a person, and Harry Dean Stanton plays it with a face like a dry riverbed — you can see where the water used to run.</p>
<p>What gets me is that the film understands solitude as something you <em>do</em> to people, not just something that happens to you. Travis didn't get lonely. He left. There's a difference the movie never lets him off the hook for.</p>
<h2>The peep-show scene</h2>
<p>And then the one-way glass. He finally finds her and can only speak to her through a phone, looking at his own reflection laid over her face, telling their story in the third person because he can't bear it in the first. It's the most honest scene about shame I know. He reunites his wife and son and then removes himself from the picture, because some people only know how to love from outside the frame.</p>
<p>Nastassja Kinski in that pink sweater, listening, slowly recognizing his voice. I think about it more than I think about most things that have actually happened to me.</p>` },

  { author: "sam", film: "lost", daysAgo: 44, lenses: ["solitude", "place", "longing"],
    title: "The Whisper We Don't Hear",
    subtitle: "Two insomniacs, one city, and the kindness of not knowing.",
    body: `<p>They meet in the worst place to be lonely: a luxury hotel in a city whose language you don't speak, awake at the wrong hours, successful enough that no one will believe you're sad. Tokyo at night does the rest — the film treats the city as a third character that is enormous, kind, and completely indifferent to you.</p>
<p>What I love is how little happens. They keep each other company. That's it. The film is brave enough to believe that <em>company</em> — not romance, not resolution — is the rare thing, and that two people can save each other's week without saving each other's life.</p>
<blockquote>The more you know who you are and what you want, the less you let things upset you. He says it to her. He clearly does not believe it about himself.</blockquote>
<p>And the ending: he whispers something into her ear that the sound mix deliberately withholds. Everyone wants to know what he says. I think the point is that it's hers. Some intimacies aren't for the audience. The film hands you a closed door and trusts you to find that generous instead of cruel.</p>` },

  { author: "theo", film: "portrait", daysAgo: 50, lenses: ["craft", "desire", "memory"],
    title: "Turn Around",
    subtitle: "On looking, being looked at, and page twenty-eight.",
    body: `<p>A painter is hired to paint a woman who refuses to be painted, so she must do it from memory, studying her by day and reconstructing her by candlelight. The film turns the act of <em>looking</em> into the whole drama. Who gets to look, who is only looked at, and what it costs to be truly seen.</p>
<p>There's almost no music in the film, which makes the two times it appears detonate. When the women on the beach begin to sing a cappella and the camera finds Héloïse through the smoke of the bonfire — I stopped breathing. Sciamma starves you of sound so that one chord lands like a confession.</p>
<blockquote>Do all lovers feel they're inventing something? She asks it as if it were a question about craft. It is.</blockquote>
<p>And the Orpheus myth, retold by candlelight: he turns around and loses her, and the painter argues he chose the memory of her over the body of her. The poet's choice, not the lover's. The film's last shot is a held close-up of a woman at a concert, not knowing she's watched, feeling the whole affair move across her face. It's the camcorder problem again — to love someone is to keep a version of them that they will never get to see.</p>` },

  { author: "nadia", film: "banshees", daysAgo: 56, lenses: ["denial", "solitude", "family"],
    title: "Niceness Is Not Kindness",
    subtitle: "A friendship ends and an island pretends not to notice.",
    body: `<p>One man decides, with no warning, that he no longer wishes to be friends with the other. That's the engine of the whole film, and it's funnier and crueler than any war, which is the joke — the actual civil war is smoke on the horizon while these two destroy each other over a withdrawn hello.</p>
<p>Pádraic is nice. The film is careful to show you that nice and kind are not the same animal. He is dull, and he cannot bear to be left, and his niceness curdles into something vengeful the second it's refused. Colm wants to make something that lasts and has decided that pleasantness is the enemy of it. They're both a little right, which is unbearable.</p>
<blockquote>I just don't like you no more. Said plainly, it's the most violent line in the film.</blockquote>
<p>Everyone on the island keeps things pleasant while a man cuts off his own fingers to spite a friendship. That's the denial the title is pointing at — a whole community committed to acting as if nothing is happening, on an island you can see the edges of. I come from a family that does this. We are very nice. We never say the thing.</p>` },
];

// --- response threads (parent + optional one reply) -------------------------
// target = perspective index (into PERSPECTIVES). reply.of = index into this list.
const RESPONSES = [
  { target: 0, author: "yuki", body: "I called my mother after this one. The Polaroid detail wrecked me — I'd read it as hope the first time and as dread the second." },
  { target: 0, author: "theo", body: "The frame rate line is exactly it. We get our parents in flashes. Stealing that." },
  { target: 2, author: "iris", body: "‘Late by a continent and two decades.’ That's the whole film. I don't think it's a love story at all, I think it's a grief story wearing a love story's coat." },
  { target: 4, author: "sam", body: "The low angles undid me too — I never had words for why that father felt so large on screen. A child's eye-line. Of course." },
  { target: 7, author: "jonah", body: "Company over romance. Yes. I've watched this maybe six times and only this year understood it's a film about being kind to a stranger, not falling for one." },
  { target: 9, author: "mara", body: "‘We are very nice. We never say the thing.’ I had to put my phone down for a minute. Same family, different island." },
];
const REPLIES = [
  { parentInList: 0, author: "mara", body: "Iris said the same to me once — that hope and dread are the same image at different ages. I think that's why the film won't resolve the shot." },
  { parentInList: 5, author: "nadia", body: "Solidarity from the other very-nice family. The film at least lets the silence be loud. We don't even manage that." },
];

const REACTION_TYPES = ["moved", "stayed_with_me", "recognized_myself", "changed_my_mind", "saw_it_differently"];

// ---------------------------------------------------------------------------
async function main() {
  console.log("Seeding demo content...\n");

  // 1. Users (create or reuse), keyed by people.key -> id
  console.log("Users:");
  const { data: existing, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw listErr;
  const byEmail = new Map((existing?.users ?? []).map((u) => [u.email, u]));
  const id = {}; // key -> uuid
  for (const p of PEOPLE) {
    let user = byEmail.get(p.email);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email: p.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { username: p.username, full_name: p.name },
      });
      if (error) throw new Error(`createUser ${p.email}: ${error.message}`);
      user = data.user;
      console.log(`  created  @${p.username}`);
    } else {
      console.log(`  reuse    @${p.username}`);
    }
    id[p.key] = user.id;
  }
  const demoIds = Object.values(id);

  // 2. Wipe prior demo content (idempotency). Perspective delete cascades
  //    reactions/responses/notifications that reference them.
  console.log("\nClearing prior demo content...");
  await admin.from("perspectives").delete().in("user_id", demoIds);
  await admin.from("follows").delete().in("follower_id", demoIds);
  await admin.from("follows").delete().in("following_id", demoIds);
  await admin.from("notifications").delete().in("user_id", demoIds);

  // 3. Profiles (mark onboarded: display_name + signature_lenses set)
  console.log("Updating profiles...");
  for (const p of PEOPLE) {
    const { error } = await admin
      .from("profiles")
      .update({ display_name: p.name, bio: p.bio, signature_lenses: p.lenses, is_private: false })
      .eq("id", id[p.key]);
    if (error) throw new Error(`profile ${p.username}: ${error.message}`);
  }

  // 4. Films
  console.log("\nResolving films from TMDB:");
  const filmId = {}; // key -> films.id
  for (const [key, spec] of Object.entries(FILMS)) {
    const film = await resolveFilm(spec);
    filmId[key] = film.id;
  }

  // 5. Perspectives
  console.log("\nInserting perspectives:");
  const now = Date.now();
  const pIds = []; // index-aligned with PERSPECTIVES
  for (const pv of PERSPECTIVES) {
    const body = pv.body.trim();
    const plaintext = htmlToPlaintext(body);
    const publishedAt = new Date(now - pv.daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("perspectives")
      .insert({
        user_id: id[pv.author],
        film_id: filmId[pv.film],
        title: pv.title,
        subtitle: pv.subtitle,
        body,
        body_plaintext: plaintext,
        lens_tags: pv.lenses,
        word_count: wordCount(plaintext),
        reading_time_minutes: readingTime(plaintext),
        is_draft: false,
        is_private: false,
        published_at: publishedAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(`perspective "${pv.title}": ${error.message}`);
    pIds.push(data.id);
    console.log(`  @${PEOPLE.find((x) => x.key === pv.author).username}: ${pv.title} (${readingTime(plaintext)} min)`);
  }

  // 6. Follows — readers follow all authors; authors follow each other.
  console.log("\nFollows...");
  const authors = PEOPLE.filter((p) => p.author);
  const followRows = [];
  for (const a of PEOPLE) {
    for (const b of authors) {
      if (a.key === b.key) continue;
      followRows.push({ follower_id: id[a.key], following_id: id[b.key] });
    }
  }
  // de-dup pairs
  const seen = new Set();
  const uniqueFollows = followRows.filter((f) => {
    const k = `${f.follower_id}:${f.following_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  {
    const { error } = await admin.from("follows").insert(uniqueFollows);
    if (error) throw new Error(`follows: ${error.message}`);
  }
  console.log(`  ${uniqueFollows.length} follow edges`);

  // 7. Reactions — deterministic spread; everyone but the author may react.
  console.log("Reactions...");
  const reactionRows = [];
  PERSPECTIVES.forEach((pv, i) => {
    PEOPLE.forEach((person, j) => {
      if (person.key === pv.author) return;
      if ((i + j) % 3 === 0) return; // skip ~1/3 for natural variation
      reactionRows.push({
        user_id: id[person.key],
        perspective_id: pIds[i],
        reaction_type: REACTION_TYPES[(i + j) % REACTION_TYPES.length],
      });
    });
  });
  {
    const { error } = await admin.from("reactions").insert(reactionRows);
    if (error) throw new Error(`reactions: ${error.message}`);
  }
  console.log(`  ${reactionRows.length} reactions`);

  // 8. Responses + one level of replies (triggers create notifications).
  console.log("Responses...");
  const responseIds = [];
  for (const r of RESPONSES) {
    const { data, error } = await admin
      .from("responses")
      .insert({
        perspective_id: pIds[r.target],
        user_id: id[r.author],
        parent_response_id: null,
        body: r.body,
        body_plaintext: r.body,
      })
      .select("id")
      .single();
    if (error) throw new Error(`response: ${error.message}`);
    responseIds.push(data.id);
  }
  for (const rep of REPLIES) {
    const parent = RESPONSES[rep.parentInList];
    const { error } = await admin.from("responses").insert({
      perspective_id: pIds[parent.target],
      user_id: id[rep.author],
      parent_response_id: responseIds[rep.parentInList],
      body: rep.body,
      body_plaintext: rep.body,
    });
    if (error) throw new Error(`reply: ${error.message}`);
  }
  console.log(`  ${RESPONSES.length} responses + ${REPLIES.length} replies`);

  // Summary
  console.log("\n----------------------------------------------------------");
  console.log("Done. Demo accounts (password for all):", PASSWORD);
  for (const p of PEOPLE) console.log(`  ${p.email.padEnd(20)} @${p.username}${p.author ? "  (author)" : ""}`);
  console.log("\nGood links to show:");
  console.log("  /mara_okafor   /theo_lindqvist   /nadia_rahman   /sam_vance");
  console.log("  a film with multiple takes + lens tabs: search 'Aftersun' or 'Past Lives'");
  console.log("  a lens page: /lens/grief   /lens/craft   /lens/longing");
}

main().then(() => process.exit(0)).catch((e) => { console.error("\nSEED FAILED:", e.message); process.exit(1); });
