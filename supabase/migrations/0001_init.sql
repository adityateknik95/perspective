-- ---------------------------------------------------------------------------
-- 0001_init.sql
-- Perspective — initial schema for profiles, avatars storage, and triggers.
--
-- Paste the entire file into the Supabase SQL Editor and run. Idempotent
-- where practical (IF NOT EXISTS / ON CONFLICT), but intended for a fresh
-- project.
-- ---------------------------------------------------------------------------

-- Case-insensitive text for username comparisons ("Alice" == "alice").
create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- profiles
-- One row per auth.users row, populated by trigger on signup.
-- Constraints:
--   username_format — lowercase alphanumeric + underscore, 3 to 20 chars.
--                     The signup flow blocks a further reserved-username list
--                     at the application layer (see src/lib/reserved-usernames.ts).
--   bio_length      — 240 chars (roughly a tweet; forces intentionality).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  username          citext unique not null,
  display_name      text not null default '',
  bio               text,
  avatar_url        text,
  signature_lenses  text[] not null default '{}',
  is_private        boolean not null default false,
  created_at        timestamptz not null default now(),

  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint bio_length      check (bio is null or char_length(bio) <= 240)
);

create index if not exists profiles_username_idx on public.profiles (username);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Idempotent policy creation.
drop policy if exists "profiles_select_public_or_owner" on public.profiles;
drop policy if exists "profiles_insert_self"            on public.profiles;
drop policy if exists "profiles_update_self"            on public.profiles;

-- SELECT: public profiles are readable by anyone (including anon).
-- Owners always see their own row, regardless of is_private.
create policy "profiles_select_public_or_owner"
  on public.profiles for select
  using (
    is_private = false
    or (auth.uid() is not null and auth.uid() = id)
  );

-- INSERT: authenticated users may insert only their own row.
-- The trigger below is the normal path; this policy is defense-in-depth.
create policy "profiles_insert_self"
  on public.profiles for insert
  with check (auth.uid() is not null and auth.uid() = id);

-- UPDATE: only the owner can modify their profile.
create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- DELETE: not exposed. Account deletion cascades from auth.users.

-- ---------------------------------------------------------------------------
-- Username availability check (bypasses RLS).
-- Lets the signup form probe whether a username is taken, even if the
-- existing owner's profile is private (RLS would otherwise hide it).
-- ---------------------------------------------------------------------------
create or replace function public.username_available(u text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where username = u::citext
  );
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: auto-create a profile row on new auth user.
--
-- The placeholder username ("u_" + 14 hex chars from the user id) satisfies
-- NOT NULL + UNIQUE + the format check without needing the user to pick one
-- synchronously. Onboarding UPDATEs this row with their chosen username.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'u_' || substr(replace(new.id::text, '-', ''), 1, 14),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage: avatars bucket
-- Public-read so <img src> works without signed URLs.
-- Upload/update/delete constrained to the user's own folder:
--   avatars/<auth.uid()>/<filename>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_read_public" on storage.objects;
drop policy if exists "avatars_insert_own"  on storage.objects;
drop policy if exists "avatars_update_own"  on storage.objects;
drop policy if exists "avatars_delete_own"  on storage.objects;

create policy "avatars_read_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
