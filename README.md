# Perspective

> A place for how you saw it, not how you rated it.

Perspective is a web app for writing about films the way you'd write in a journal — not reviews, not ratings, but reflections on what the film made you see. Instead of stars there are **lenses** (grief, memory, craft, denial, …). Instead of reviews there are **perspectives**. The writing is the product; readers react, respond, and follow writers.

---

## Contents

- [Stack](#stack)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Database migrations](#database-migrations)
- [Scripts](#scripts)
- [Testing](#testing)
- [Routes](#routes)
- [Architecture and security](#architecture-and-security)
- [Production deploy (Supabase + Vercel)](#production-deploy-supabase--vercel)
- [Launch checklist](#launch-checklist)
- [Project layout](#project-layout)

---

## Stack

- **Next.js 14** (App Router, TypeScript strict), deployed on **Vercel**
- **Supabase** — Postgres (RLS does the access control), Auth, Storage
- **TMDB** (v4 read token) for film data, cached in our own `films` table
- **Tiptap v2** editor; **sanitize-html** allowlist for its output
- **zod** schemas shared by client and server; **react-hook-form**
- **Tailwind CSS** editorial theme (light + dark); **framer-motion**, **@react-three/fiber**, **lenis** on the landing page
- **Upstash Redis** (optional, REST — no SDK) for shared rate limits
- **Vitest** (unit), a PostgREST-level RLS suite (`scripts/verify-social-rls.mjs`), **Playwright** (end to end)
- **pnpm** 9, Node 20+

---

## Local setup

### Prerequisites

- **Node.js 20+** (`nvm use` picks up `.nvmrc`)
- **pnpm 9**: `corepack enable && corepack prepare pnpm@9 --activate`
- A **Supabase** project ([supabase.com](https://supabase.com)) — free tier is fine
- A **TMDB** account and v4 API Read Access Token ([themoviedb.org](https://www.themoviedb.org/settings/api))

### 1. Install

```bash
git clone <your-fork-url> perspective
cd perspective
pnpm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in the five required values (see [Environment variables](#environment-variables)). The server validates every variable at boot and **refuses to start** with a list of what's missing or malformed, so a typo fails immediately rather than on some page later.

### 3. Run the migrations

Migrations are plain SQL in `supabase/migrations/`, written to be pasted into the Supabase **SQL Editor** and run **in order, 0001 → 0013**. Every one is idempotent — re-running is safe. See [Database migrations](#database-migrations) for what each does.

(If you have a Supabase Personal Access Token, `node --env-file=.env.local scripts/db-exec.mjs supabase/migrations/0006_perspective_write_guards.sql` runs one through the Management API instead.)

### 4. Configure Supabase Auth

In **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: `http://localhost:3000/auth/callback`

Optional — **Google sign-in**: enable the Google provider under **Authentication → Providers**, create an OAuth client in Google Cloud Console with redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, and paste the client ID and secret into Supabase.

### 5. Run

```bash
pnpm dev
```

Open <http://localhost:3000>, sign up, confirm the email, onboard, and write. For a populated walkthrough, `node scripts/seed-demo.mjs` seeds demo writers, films (needs TMDB), perspectives and a social graph.

---

## Environment variables

Validated at startup by `src/lib/env.ts` (empty strings count as unset). `.env.local.example` has the same list with where to find each value.

| Variable | Required | Exposed to browser | What it's for |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | Public anon key — safe to expose; RLS enforces access |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **no** | Server-only writes: sanitized perspective bodies, avatar URLs, film cache, moderation, account deletion |
| `NEXT_PUBLIC_SITE_URL` | yes | yes | Canonical origin: OAuth/email redirects, `og:image`, sitemap, robots |
| `TMDB_ACCESS_TOKEN` | yes | **no** | TMDB v4 read token (film search, first view of a film) |
| `UPSTASH_REDIS_REST_URL` | no¹ | no | Shared rate-limit store. Set with the token, or neither |
| `UPSTASH_REDIS_REST_TOKEN` | no¹ | no | Pair of the above |
| `ADMIN_USER_IDS` | no | no | Comma-separated auth user UUIDs allowed into `/admin/reports` |
| `ERROR_WEBHOOK_URL` | no | no | Error reports are POSTed here as JSON (Slack/Discord-compatible `text`). Unset → no-op |

¹ Without Upstash, rate limits fall back to per-instance memory and the server logs a warning in production. On Vercel that makes limits advisory — set it for production.

Script-only: `SUPABASE_PAT` (for `scripts/db-exec.mjs`). Testing-only: `E2E_BASE_URL` (see [Testing](#testing)).

---

## Database migrations

Run in order. Each file's header explains the before/after and the reasoning.

| # | File | What it does |
| --- | --- | --- |
| 0001 | `0001_init.sql` | `profiles` (+ `is_private`), signup trigger creating the profile, `username_available` RPC, public `avatars` bucket with per-user folder policies |
| 0002 | `0002_films_perspectives.sql` | `films` (TMDB cache, service-role write only) and `perspectives` (lens tags, draft/publish shape constraint), RLS |
| 0003 | `0003_draft_empty_title.sql` | Drafts may have an empty title; 1–120 enforced at publish |
| 0004 | `0004_social.sql` | `reactions`, `responses` (one level of replies), `response_resonances`, `follows`, `notifications` (trigger-populated), `reports`; summary + feed RPCs |
| 0005 | `0005_reaction_summaries_bulk.sql` | Bulk reaction-summary RPC for list pages |
| 0006 | `0006_perspective_write_guards.sql` | Column grants: the browser can't write `body`, word counts, `is_draft`, `published_at`, etc. — only the server, after sanitizing. `published_at` is write-once |
| 0007 | `0007_profile_privacy.sql` | A private profile's perspectives are owner-only. `perspective_is_visible()` / `is_profile_public()` helpers; `profile_cards` view so private users' public responses keep a name |
| 0008 | `0008_social_visibility.sql` | Reactions / responses / resonances require a visible target; replies must be top-level on the same piece; response column grants |
| 0009 | `0009_feed_auth_uid.sql` | `get_feed_for_user` uses `auth.uid()` — no user-id argument; anon can't call it |
| 0010 | `0010_avatar_guards.sql` | `avatar_url` not browser-writable and pinned to the owner's own `avatars/<id>/` folder; bucket enforces 5 MB and JPEG/PNG/WebP |
| 0011 | `0011_account_deletion.sql` | Deleting a user keeps other people's replies: their threaded responses are detached (author NULL, body `[deleted]`) instead of cascading |
| 0012 | `0012_moderation.sql` | `hidden_at` on perspectives/responses, report status, one report per reporter per target; response bodies readable only via `get_response_thread()` (masks deleted/hidden) |
| 0013 | `0013_moderation_audit_columns.sql` | Fix for 0012: `hidden_by` / `resolved_by` become plain audit columns (as FKs they made PostgREST author embeds ambiguous) |

---

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server with hot reload |
| `pnpm build` / `pnpm start` | Production build / serve it |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint (`next lint`) |
| `pnpm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `pnpm test:e2e` | Playwright end-to-end tests (`e2e/`) — see below |
| `node --env-file=.env.local scripts/verify-social-rls.mjs` | Database rules suite — see below |
| `node scripts/seed-demo.mjs` | Seed demo writers, films, pieces and a social graph |
| `node scripts/create-test-user.mjs <email> <password> <username> [name]` | Create a confirmed user, bypassing email |
| `node scripts/list-users.mjs` | List auth users |
| `node --env-file=.env.local scripts/db-exec.mjs <file.sql>` | Run a SQL file via the Management API (needs `SUPABASE_PAT`) |

---

## Testing

Three layers, each catching what the others can't. CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests and build on every push and PR, and the e2e job when its secrets are configured.

### Unit — `pnpm test`

Vitest in Node: sanitizer, safe redirects, rate limiter (both stores), env validation, middleware decisions, server actions with mocked clients, SEO, share-card text, CSP. No network, no database.

### Database rules — `scripts/verify-social-rls.mjs`

The security model lives in Postgres, and the anon key is public, so the rules are tested **the way an attacker would hit them**: directly against PostgREST as anon, user A and user B, never through a server action. 88 checks covering every migration (column grants, visibility, reply rules, moderation, account deletion, embed shapes).

```bash
node --env-file=.env.local scripts/verify-social-rls.mjs
```

Run it against a **disposable** project or a local stack — it creates and deletes users. Exits non-zero on any failure.

### End to end — `pnpm test:e2e`

Playwright drives the real UI through the core loop as two people: sign up → confirm → sign in → onboard → write (Tiptap, autosave) → share; a second user reacts and responds; the writer sees the response; every page carries the TMDB notice.

```bash
pnpm build
NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… pnpm test:e2e
```

- Playwright starts `pnpm start -p 3100` itself; set `E2E_BASE_URL` to test an already-running app instead.
- Use a **disposable** Supabase project with all migrations applied and **Confirm email turned off** (Supabase's built-in mailer won't deliver to test addresses). The suite creates `*@e2e.perspective-test.local` users and deletes them afterwards.
- TMDB isn't needed: the suite seeds a cached film row.
- First run: `pnpm exec playwright install chromium`.
- **CI:** add repository secrets `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY`. Without them the `e2e` job logs a notice and passes, so forks stay green. On failure it uploads the Playwright report and traces.

---

## Routes

| Path | Access | What it is |
| --- | --- | --- |
| `/` | Public | Landing page (signed-in users are redirected to `/home`) |
| `/signup`, `/login` | Public | Email/password and Google sign-in (rate limited) |
| `/forgot-password`, `/reset-password` | Public | Password reset (no user enumeration; rate limited) |
| `/auth/callback` | Public | OAuth / email-link code exchange; `next` validated by `safeNextPath` |
| `/onboarding` | Signed in | Display name → bio → signature lenses |
| `/home` | Signed in | Films · Following · Writing tabs |
| `/[username]` | Public¹ | Profile: public feed, plus drafts/private/hidden for the owner |
| `/[username]/followers`, `/[username]/following` | Public¹ | Follow lists |
| `/film/[tmdbId]` | Public | Film page, lens-filtered perspectives, TMDB credit |
| `/lens/[lens]` | Public | Everything filed under one lens |
| `/perspective/[id]` | Public² | Read view: reactions, responses, report button |
| `/perspective/[id]/opengraph-image` (+ `twitter-image`) | Public | 1200×630 share card (anon view only) |
| `/write/new` | Signed in | Creates a draft (`?film=<tmdbId>`) or shows the film picker |
| `/write/[id]` | Owner | Tiptap editor, autosave, share panel |
| `/search` | Public | Find people |
| `/notifications` | Signed in | Inbox |
| `/settings` | Signed in | Profile, privacy, avatar, delete account |
| `/admin/reports` | Admins | Moderation queue (404 for everyone else) |
| `/terms`, `/privacy` | Public | Legal pages (**drafts**, noindex) |
| `/design-system` | Public | Developer reference for tokens and components |
| `/sitemap.xml`, `/robots.txt` | Public | Public published pieces only; previews disallow all |
| `/api/film-search` | Public | TMDB search proxy (rate limited per IP) |
| `/api/people-search` | Public | Username / display-name search (rate limited) |
| `/api/username-available` | Public | UX-only availability check |
| `/api/client-error` | Public | Error-boundary reports → `ERROR_WEBHOOK_URL` (bounded, rate limited) |

¹ Private profiles show a private shell to everyone but the owner. ² Drafts, private and hidden pieces, and pieces by private profiles 404 for everyone but the author.

---

## Architecture and security

The anon key ships to every browser, so **the database enforces every rule by itself**; server actions add friendly error messages on top, never the only check.

- **Who can read what** is one rule, `perspective_is_visible(id)`: you own it, or it's published, not private, not hidden, and by a public profile. Perspectives, reactions, responses, resonances, reports and share cards all ask it.
- **Server-derived columns** (sanitized `body`, plaintext, word counts, draft/publish state, `avatar_url`) can't be written by the browser role at all (column grants). The server writes them with the service role **after** authenticating, checking ownership and sanitizing in Node — `src/lib/perspectives/writer.ts` pins every write to `(id, user_id)`. HTML is also re-sanitized at render.
- **Response bodies** aren't selectable by the browser role; threads come from `get_response_thread()`, which withholds deleted and hidden bodies.
- **Sessions** refresh in middleware on every page route. Signed-out requests cost nothing (no auth cookie → return); signed-in public pages refresh only when the access token has expired.
- **Redirects** after sign-in go through `safeNextPath` (no backslashes, control characters or off-origin targets).
- **Rate limits** (`src/lib/rate-limit.ts`): Upstash fixed windows over REST with an in-memory fallback; keys are SHA-256 hashed before they leave the process (no emails or IPs at Upstash).
- **Films** are reference data: a cache hit never calls TMDB; new films are rate limited per client and globally.
- **Moderation**: signed-in readers report; admins (`ADMIN_USER_IDS`) hide/dismiss from `/admin/reports`. Hidden content stays visible to its author, flagged.
- **Headers**: CSP (scripts self + inline, images self/TMDB/Supabase, connect self/Supabase, no framing), HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP — see `security-headers.mjs`. `script-src` needs `'unsafe-inline'` for Next 14's inline bootstrap; a per-request nonce would remove that at the cost of rendering every page dynamically.
- **Errors**: `error.tsx` / `global-error.tsx` show a digest reference; reports go to `ERROR_WEBHOOK_URL` when set.
- **Published pieces are immutable**: Edit reverts to draft; re-sharing keeps the original `published_at` (enforced write-once in the database).

---

## Production deploy (Supabase + Vercel)

### Supabase

1. Create the production project (pick the region closest to your users; note it for the privacy page).
2. Run migrations **0001 → 0013** in order in the SQL Editor. Then confirm under **Storage → avatars** that the bucket shows a 5 MB limit and JPEG/PNG/WebP types (set by 0010).
3. **Authentication → URL Configuration**: Site URL `https://<your-domain>`; Redirect URLs `https://<your-domain>/auth/callback` plus your Vercel preview pattern (e.g. `https://*-<team>.vercel.app/auth/callback`) if previews should sign in.
4. **Authentication → Emails**: configure **custom SMTP**. Supabase's built-in mailer is heavily rate-limited and only meant for testing; signup confirmation and password reset depend on it.
5. Keep **Confirm email** on in production.
6. Optional: Google provider (redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`).
7. Backups: check your plan's backup / PITR retention (and put the number in the privacy page).
8. Before launch, run `scripts/verify-social-rls.mjs` against a **staging** project with the same migrations — never production (it creates users).

### Vercel

1. Import the repo; framework preset Next.js, install `pnpm install --frozen-lockfile`, build `pnpm build`.
2. Environment variables — set for **Production** and **Preview** separately:
   - the five required ones (Preview can point at a staging Supabase project);
   - `NEXT_PUBLIC_SITE_URL` = the canonical domain in Production. For Preview, use the preview URL or a fixed staging domain — it's used for redirects and share-card URLs;
   - `UPSTASH_REDIS_REST_URL` / `_TOKEN` (create a database at [upstash.com](https://upstash.com));
   - `ADMIN_USER_IDS`, `ERROR_WEBHOOK_URL` as needed.
3. Deploy. A missing or malformed variable makes the function exit at boot with the list of problems — check the function logs.
4. Smoke test: sign up, write, share, open the share card URL, `curl -I` a page to see the security headers, and visit `/robots.txt` (previews should disallow `/`).

---

## Launch checklist

Decisions and assets the code can't supply:

- [ ] **TMDB logo** — download an approved logo from TMDB's brand page and save it as `public/tmdb-logo.svg`. Until then the footer shows the text notice only. The logo must stay less prominent than Perspective's own mark.
- [ ] **TMDB licence** — the free API is for non-commercial use. If Perspective earns revenue (ads, subscriptions, paid features, or as a revenue-driving destination site), get a commercial licence from TMDB first.
- [ ] **Legal pages** — `/terms` and `/privacy` are **drafts** with highlighted `[placeholders]` (operator name, contacts, minimum age, legal basis, governing law, retention periods, liability). Have them reviewed, fill them in, then remove the draft banner (`src/components/legal/legal-page.tsx`) and the `noindex` in each page's metadata.
- [ ] `ADMIN_USER_IDS` set to at least one moderator.
- [ ] Upstash configured for production rate limits.
- [ ] Custom SMTP in Supabase Auth.
- [ ] `ERROR_WEBHOOK_URL` pointed somewhere someone reads (or accept console-only errors).
- [ ] Optional hardening: nonce-based CSP (removes `'unsafe-inline'` from `script-src`).
- [ ] E2E secrets added to GitHub so the `e2e` CI job runs.

---

## Project layout

```
src/
  app/
    (auth)/                 login, signup, password reset (+ actions)
    (app)/                  everything with the app header + footer
      [username]/           profile, followers, following, follow action
      admin/reports/        moderation queue + actions (admins only)
      film/[tmdbId]/        film page
      home/                 Films · Following · Writing tabs
      lens/[lens]/          lens page
      notifications/        inbox
      onboarding/           three-step onboarding
      perspective/[id]/     read view, reactions/responses actions, share card
      privacy/, terms/      legal drafts
      search/               find people
      settings/             profile, avatar, delete account
      write/                draft creation, editor, publish
      error.tsx             error boundary that keeps the app shell
    api/                    film-search, people-search, username-available, client-error
    auth/callback/          OAuth / email-link handler
    error.tsx, global-error.tsx
    sitemap.ts, robots.ts
  components/               UI primitives, layout (header, footer), reactions,
                            responses, moderation (report button), tmdb, legal, empty
  lib/
    supabase/               server, browser, middleware, admin (service role), anon
    validation/             zod schemas shared client/server (import z from ./zod)
    perspectives/writer.ts  the only writer of server-derived perspective columns
    moderation/             admin gate, report queue
    env.ts                  startup env validation
    rate-limit.ts           Upstash + in-memory limiter
    monitoring.ts           reportError() → ERROR_WEBHOOK_URL
    safe-redirect.ts, sanitize-html.ts, films.ts, seo.ts, share-card.ts, …
  instrumentation.ts        runs env validation at server boot
  middleware.ts             session refresh + protected-path redirects
security-headers.mjs        CSP and security headers (used by next.config.mjs)
supabase/migrations/        0001 → 0013, run in order
scripts/                    RLS verification, seeding, admin utilities
e2e/                        Playwright specs + service-role helpers
```

---

## License

TBD.
