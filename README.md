# Perspective

> A place for how you saw it, not how you rated it.

Perspective is a web app for writing about films the way you'd write in a journal — not reviews, not ratings, but reflections on what the film made you see. Instead of stars, we have **lenses** (grief, memory, craft, denial, and so on). Instead of reviews, we have **perspectives**. The writing is the product.

This repository is the Next.js 14 foundation. Films, the writing editor, feeds, and social features will be layered on top in subsequent work.

---

## Stack

- **Next.js 14** (App Router, TypeScript, strict)
- **Tailwind CSS** with a custom editorial theme
- **Supabase** for Postgres, Auth, and Storage (via `@supabase/ssr`)
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

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and paste the three values above. Leave `NEXT_PUBLIC_SITE_URL` as `http://localhost:3000` for local development.

### 5. Run the SQL migration

Migrations live in `supabase/migrations/`. They are plain SQL, designed to be pasted into the Supabase SQL editor.

1. Open your project's **SQL Editor** in the Supabase dashboard.
2. Click **New query**, paste the full contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it.
3. Verify the `profiles` table appears under **Table editor**, and the `avatars` bucket appears under **Storage**.

### 6. (Optional) Enable Google OAuth

> Google sign-in is supported but not required for local development.

1. In Supabase: **Authentication → Providers → Google**, toggle **Enabled**.
2. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Create Credentials → OAuth client ID → Web application**.
3. Add **Authorized redirect URI**:
   ```
   https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
   ```
4. Paste the Google **Client ID** and **Client Secret** into the Supabase provider settings and save.

### 7. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

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

## Project layout

```
src/
  app/                     Next.js App Router routes
    (auth)/                Login, signup, password reset
    (app)/                 Authed layout with header — onboarding, settings, /[username]
    auth/callback/         OAuth + email verification handler
    design-system/         Developer-facing reference page
    api/                   Route handlers (e.g. username availability)
  components/
    ui/                    Primitives: Button, Input, LensChip, Logo...
    layout/                AppHeader, AvatarMenu
    animated/              Motion and r3f scenes
  lib/
    supabase/              Server, client, and middleware helpers
    validation/            Zod schemas shared between client and server
    lenses.ts              Canonical lens list
    reserved-usernames.ts  Blocklist for /[username] collisions
supabase/migrations/       SQL migrations (paste into Supabase SQL editor)
```

---

## Contributing

This repo is built in reviewable slices. See commit history for the progression. Each slice is self-contained: scaffold → design system → Supabase → auth → profile flows → landing.

---

## License

TBD.
