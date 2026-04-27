-- ---------------------------------------------------------------------------
-- 0002_films_perspectives.sql
-- Perspective — films cache + perspectives (the writing product).
--
-- Paste the entire file into the Supabase SQL Editor and run. Idempotent
-- where practical. Depends on 0001_init.sql (profiles table).
-- ---------------------------------------------------------------------------

-- gen_random_uuid(). Supabase has this available by default, but let's make
-- the migration self-contained.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- One function, reused by every table that has an updated_at column.
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- films
-- Append-only cache of TMDB films. No user data lives here — it's reference
-- data populated by the server using the service-role key when someone visits
-- a film page for the first time. RLS keeps read open and write closed.
-- ---------------------------------------------------------------------------

create table if not exists public.films (
  id                 uuid        primary key default gen_random_uuid(),
  tmdb_id            int         not null unique,
  title              text        not null,
  year               int,
  director           text,
  runtime_minutes    int         check (runtime_minutes is null or runtime_minutes > 0),
  overview           text,
  poster_path        text,
  backdrop_path      text,
  original_language  text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists films_tmdb_id_idx on public.films (tmdb_id);

alter table public.films enable row level security;

drop policy if exists "films_select_public"  on public.films;
drop policy if exists "films_insert_blocked" on public.films;
drop policy if exists "films_update_blocked" on public.films;
drop policy if exists "films_delete_blocked" on public.films;

-- Anyone (even signed-out) can read films. Write access is deliberately not
-- granted to any role — service-role bypasses RLS, which is how the server
-- populates the cache. Keeping the absence of write policies documented here
-- is the product decision: films aren't user-editable.
create policy "films_select_public" on public.films
  for select using (true);

drop trigger if exists films_set_updated_at on public.films;
create trigger films_set_updated_at
  before update on public.films
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- perspectives
-- The main product. One row per piece of writing.
--
-- Lens enforcement: lens_tags must be a subset of ALLOWED_LENSES (mirror of
-- src/lib/lenses.ts). Cardinality 0–3 on drafts, strictly 1–3 once published.
-- Keep this list and the TS constant in sync.
--
-- Publish rule: published_at must be set whenever is_draft = false. The app
-- stamps published_at the first time a row leaves draft state and never
-- clears it (so "un-publishing" back to draft preserves the original date —
-- the check only requires published_at IS NOT NULL once, not forever).
-- ---------------------------------------------------------------------------

create table if not exists public.perspectives (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references public.profiles(id) on delete cascade,
  film_id               uuid        not null references public.films(id)    on delete restrict,
  -- Drafts start empty; the publish_shape check below enforces 1-120 at publish
  -- time. Column-level check only caps the upper bound.
  title                 text        not null default ''
                                    check (char_length(title) <= 120),
  subtitle              text
                                    check (subtitle is null or char_length(subtitle) between 1 and 200),
  body                  text        not null default '',
  body_plaintext        text        not null default '',
  lens_tags             text[]      not null default '{}'
                                    check (
                                      lens_tags <@ array[
                                        'grief','memory','craft','denial','family','politics',
                                        'solitude','childhood','self','faith','work','place',
                                        'desire','violence','longing','time','language','sound'
                                      ]::text[]
                                      and cardinality(lens_tags) between 0 and 3
                                    ),
  word_count            int         not null default 0 check (word_count >= 0),
  reading_time_minutes  int         not null default 0 check (reading_time_minutes >= 0),
  is_draft              boolean     not null default true,
  is_private            boolean     not null default false,
  published_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Publish rule: once published, a title (1-120), 1-3 lenses, and a
  -- published_at are required. Drafts are free-form.
  constraint perspectives_publish_shape
    check (
      is_draft
      or (
        published_at is not null
        and char_length(title) between 1 and 120
        and cardinality(lens_tags) between 1 and 3
      )
    )
);

-- Feed-style lookups by author, newest first.
create index if not exists perspectives_user_published_idx
  on public.perspectives (user_id, published_at desc nulls last);

-- Film page lookups.
create index if not exists perspectives_film_published_idx
  on public.perspectives (film_id, published_at desc nulls last);

-- Lens filtering (GIN = subset / overlap queries on arrays).
create index if not exists perspectives_lens_tags_gin
  on public.perspectives using gin (lens_tags);

alter table public.perspectives enable row level security;

drop policy if exists "perspectives_select_visible" on public.perspectives;
drop policy if exists "perspectives_insert_self"    on public.perspectives;
drop policy if exists "perspectives_update_self"    on public.perspectives;
drop policy if exists "perspectives_delete_self"    on public.perspectives;

-- Visibility rules:
--   - Your own row is always visible to you (drafts + private included).
--   - Everyone else only sees published, non-private rows.
create policy "perspectives_select_visible" on public.perspectives
  for select using (
    user_id = auth.uid()
    or (is_draft = false and is_private = false)
  );

create policy "perspectives_insert_self" on public.perspectives
  for insert with check (user_id = auth.uid());

create policy "perspectives_update_self" on public.perspectives
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "perspectives_delete_self" on public.perspectives
  for delete using (user_id = auth.uid());

drop trigger if exists perspectives_set_updated_at on public.perspectives;
create trigger perspectives_set_updated_at
  before update on public.perspectives
  for each row execute function public.set_updated_at();
