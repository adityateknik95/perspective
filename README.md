# Perspective

> A place for how you saw it, not how you rated it.

Perspective is a web app for writing about films the way you'd write in a journal — not reviews, not ratings, but reflections on what the film made you see. Instead of stars, we have **lenses** (grief, memory, craft, denial, and so on). Instead of reviews, we have **perspectives**. The writing is the product.

This repository contains the Next.js 14 app, the films + perspectives data layer, and the Tiptap-based writing experience. Feeds beyond a single author's profile, social features (follows, comments, reactions), and library/watchlist surfaces are the next layer.

---

## Stack

- **Next.js 14** (App Router, TypeScript, strict)
- **Tailwind CSS** with a custom editorial theme
- **Supabase** for Postgres, Auth, and Storage (via `@supabase/ssr`)
- **TMDB** (v4 Read Access Token) for film metadata, cached through Next's fetch cache
- **Tiptap v2** for the writing experience (StarterKit + Placeholder, Link, Underline, Typography)
- **sanitize-html** as the server-side allowlist for Tiptap output
- **react-hook-form** + **zod** for form validation, shared client + server
- **framer-motion**, **@react-three/fiber** + **drei**, **lenis** for the landing page
- **pnpm** 9, Node 20+
- Deploys to **Vercel**

---

## Prerequisites

- **Node.js** 20 or newer. Verify with `node -v`. If you use `nvm`, run `nvm use` in the repo root to pick up `.nvmrc`.
- **pnpm** 9. The easiest install is via Corepack (ships with Node):
  ```bash
  corepack enable
  corepack prepare pnpm@9 --activate
  ```
  If Corepack complains about permissions on Windows, fall back to `npm install -g pnpm@9`.
- A free **Supabase** account — [supabase.com](https://supabase.com).
- A free **TMDB** account — [themoviedb.org](https://www.themoviedb.org/signup). Required for the film search and film pages; the app will not start the editor flow without it.

---

## Setup from zero

### 1. Clone and install

```bash
git clone <your-fork-url> perspective
cd perspective
pnpm install
```

### 2. Create a Supabase project

1. Sign in at [supabase.com](https://supabase.com) and click **New project**.
2. Pick an org, name the project (e.g. `perspective-dev`), set a strong database password (store it in your password manager — you won't need it day-to-day but you will if you ever restore from a dump), and pick the region closest to you.
3. Wait for provisioning (~2 minutes).

### 3. Grab your API credentials

In the Supabase dashboard for your new project:

- **Project Settings → API**
  - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
  - Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` *(keep this secret; never ship to the browser)*

### 4. Get a TMDB API token

The film search, film pages, and draft creation all go through TMDB.

1. Sign in at [themoviedb.org](https://www.themoviedb.org) and open **Settings → API**.
2. Request an API key if you don't have one (the free developer tier is fine).
3. Copy the **API Read Access Token** (v4, starts with `eyJhbGci…`) — NOT the v3 short key. This is the bearer token we use for all TMDB calls.

### 5. Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and paste:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from step 3
- `TMDB_ACCESS_TOKEN` from step 4
- Leave `NEXT_PUBLIC_SITE_URL` as `http://localhost:3000` for local development

### 6. Run the SQL migrations

Migrations live in `supabase/migrations/`. They are plain SQL, designed to be pasted into the Supabase SQL editor. Run them in order on a fresh project.

1. Open your project's **SQL Editor** in the Supabase dashboard.
2. **New query** → paste [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → run. This sets up `profiles`, the avatars Storage bucket, and the `username_available` RPC.
3. **New query** → paste [`supabase/migrations/0002_films_perspectives.sql`](supabase/migrations/0002_films_perspectives.sql) → run. This adds `films` (TMDB cache, service-role write), `perspectives` (user-authored journals with lens tags), and their RLS policies.
4. Verify under **Table editor**: `profiles`, `films`, and `perspectives` all exist. Under **Storage**: the `avatars` bucket is present.

### 7. (Optional) Enable Google OAuth

> Google sign-in is supported but not required for local development.

1. In Supabase: **Authentication → Providers → Google**, toggle **Enabled**.
2. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Create Credentials → OAuth client ID → Web application**.
3. Add **Authorized redirect URI**:
   ```
   https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
   ```
4. Paste the Google **Client ID** and **Client Secret** into the Supabase provider settings and save.

### 8. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 9. Try the full flow

1. Click **Start writing** on the landing page → you land on `/signup`.
2. Pick an email, password, and a username (watch the live availability check).
3. Supabase sends a verification email; click the link to land on `/onboarding`.
4. Fill in display name → bio → lenses and submit — you're dropped on your profile at `/<your-username>`.
5. Click **Write**. Search for a film in the combobox — results stream from TMDB.
6. Pick a film. A draft is created and you're redirected into the Tiptap editor. Type anything; "Saving…" appears in the status bar, then "Saved 10:32" once the debounced autosave lands.
7. Click **Share…**. Pick 1-3 lenses, optionally toggle privacy, confirm. You land on `/perspective/<uuid>` with the drop-cap read view.
8. Revisit `/<your-username>` — your piece is in the **Journals** feed. Drafts and private pieces appear below in **Only visible to you**.
9. Open your piece, click **Edit**, accept the "reopen for editing" confirmation — you're back in the editor with the piece reverted to draft. Re-share to restore it (the original publication date is preserved).

If you skipped the Google OAuth step, the **Sign in with Google** button will surface a Supabase error — that's expected and means the provider isn't configured yet.

---

## Scripts

| Command           | What it does                              |
| ----------------- | ----------------------------------------- |
| `pnpm dev`        | Start the dev server with hot reload      |
| `pnpm build`      | Production build                          |
| `pnpm start`      | Serve the production build                |
| `pnpm lint`       | Run ESLint                                |
| `pnpm typecheck`  | Run the TypeScript compiler in check mode |

---

## Routes

| Path                       | Access           | What it is                                                                 |
| -------------------------- | ---------------- | -------------------------------------------------------------------------- |
| `/`                        | Public           | Landing page with r3f hero + lenis smooth scroll (signed-in users redirect) |
| `/design-system`           | Public           | Developer reference — tokens, type, buttons                                |
| `/signup`, `/login`        | Public           | Email/password + Google OAuth                                              |
| `/forgot-password`         | Public           | Requests a reset link (no user enumeration)                                |
| `/reset-password`          | Public           | New-password form reached from the reset email                             |
| `/auth/callback`           | Public           | Exchanges the OAuth / email-verification code for cookies                  |
| `/onboarding`              | Authenticated    | Three-step display name → bio → lenses                                     |
| `/settings`                | Authenticated    | Profile editing, privacy toggle, avatar upload                             |
| `/[username]`              | Public           | Profile — public feed + owner-only drafts/private section                  |
| `/film/[tmdbId]`           | Public           | Film page — TMDB metadata, lens-filtered perspectives, paginated           |
| `/perspective/[id]`        | Public           | Read view — byline, film card, drop-cap body, next-perspective link        |
| `/write/new`               | Authenticated    | Creates a draft (`?film=<tmdbId>`) or shows film picker                    |
| `/write/[perspectiveId]`   | Authenticated    | Tiptap editor with 1.5s autosave, bubble toolbar, publish dialog           |
| `/api/film-search`         | Public           | Server-side TMDB proxy (keeps the bearer token off the client)             |
| `/api/username-available`  | Public           | UX-only availability check (UNIQUE constraint is the truth)                |

---

## Project layout

```
src/
  app/                     Next.js App Router routes
    (auth)/                Login, signup, password reset
    (app)/                 Authed layout with header — onboarding, settings, profile,
                           film pages, read view, writing editor
      [username]/          Profile page (public feed + owner drafts/private section)
      film/[tmdbId]/       Film page with lens tabs + paginated perspectives
      perspective/[id]/    Read view with drop-cap typography and OG/Twitter meta
      write/new/           Draft-creation entry; redirects to the editor
      write/[perspectiveId]/   Tiptap editor, autosave, publish dialog, delete
    auth/callback/         OAuth + email verification handler
    design-system/         Developer-facing reference page
    api/
      film-search/         Server-side TMDB proxy
      username-available/  Username availability check
  components/
    ui/                    Primitives: Button, Input, LensChip, Avatar, Logo...
    layout/                AppHeader, AvatarMenu
    landing/               Hero scene (r3f), Lenis smooth-scroll, landing composition
    auth/                  Shared auth bits (e.g. GoogleButton)
    film-search.tsx        Debounced TMDB combobox
    film-poster.tsx        next/image wrapper with editorial shadow + fallback
    perspective-card.tsx   Shared row used by film page + profile feed
  lib/
    supabase/              Server, browser, middleware, and admin (service-role) clients
    validation/            Zod schemas shared between client and server
    tmdb/                  Server-only TMDB client, URL helpers, normalized types
    sanitize-html.ts       Whitelist for Tiptap HTML + plaintext extractor (server-only)
    reading.ts             Word count, reading-time, excerpt
    prompts.ts             Rotating writing prompts
    year-in-words.ts       "nineteen ninety three"-style year rendering
    lenses.ts              Canonical lens list
    films.ts               getOrCreateFilmByTmdbId — film cache upsert (server-only)
    reserved-usernames.ts  Blocklist for /[username] collisions
supabase/migrations/       SQL migrations (paste into Supabase SQL editor)
  0001_init.sql            profiles, avatars bucket, username_available RPC
  0002_films_perspectives.sql   films + perspectives + RLS
```

---

## Architecture notes

A few decisions worth knowing before you start reading code:

- **Films are reference data, not user content.** The `films` table is populated by a service-role upsert on first view of `/film/[tmdbId]` (see `src/lib/films.ts`). RLS allows any read; writes are service-role only. The alternative — an authenticated-user insert policy — would add a spam surface without protecting anyone, since film rows aren't owned.
- **Published perspectives are immutable.** Clicking **Edit** on `/perspective/[id]` explicitly reverts the piece to a draft (`revertToDraftAction`) and routes to the editor. The editor itself refuses to accept keystrokes on a non-draft row. The goal: a half-finished sentence typed at 2am is never live for 90 seconds. Re-publishing preserves `published_at`, so timelines don't shuffle.
- **Plaintext + word count + reading time are server-derived.** They're recomputed from the sanitized HTML on every save (`src/lib/reading.ts`). The client never gets a vote.
- **HTML is allowlisted, not blocklisted.** `src/lib/sanitize-html.ts` enumerates every tag and attribute Tiptap can produce; everything else is stripped. `http`, `https`, and `mailto` are the only `href` schemes accepted.
- **Autosave has a 1.5s debounce with in-flight dedup.** A second keystroke during a save reschedules rather than racing. `beforeunload` flushes a pending timer so closing the tab doesn't eat your last sentence.
- **TMDB uses Next's fetch cache.** Film detail is cached 1 week, search results 1 hour, per Next's `revalidate`. A request-lifetime LRU on top dedups repeated lookups within one render.

## Contributing

This repo is built in reviewable slices. See commit history for the progression. Each slice is self-contained:

- **Week 1:** scaffold → design system → Supabase → auth → profile flows → landing
- **Week 2:** tmdb/editor libs → films + perspectives migration → film search + film page → Tiptap editor + autosave + publish → read view → profile feed → README

---

## License

TBD.
