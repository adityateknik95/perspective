-- ---------------------------------------------------------------------------
-- 0010_avatar_guards.sql
-- Perspective — lock down profiles.avatar_url and the avatars bucket.
--
-- Before: profiles_update_self let an owner write any column through
--         PostgREST, including avatar_url. Any URL could be stored, and
--         <Avatar> renders it `unoptimized` (no host allowlist), so every
--         reader's browser fetched an attacker-chosen URL: a tracking pixel
--         that leaks readers' IPs and what they read, or imagery that never
--         passed through our upload path or moderation.
--         The avatars bucket accepted any file type and size from direct
--         Storage API uploads (the 5 MB / JPEG-PNG-WebP rules lived only in
--         the server action), e.g. an SVG or HTML file served publicly.
--
-- After:
--   1. Column grants on profiles, same approach as 0006: the browser role
--      may UPDATE only the fields the settings / onboarding forms edit, and
--      INSERT only what the signup trigger would. avatar_url is written by
--      the server (service role) after it has sniffed the uploaded bytes.
--   2. profiles_avatar_url_own_folder: avatar_url must be NULL or a public
--      object URL inside avatars/<the row's own id>/. Host isn't pinned
--      here (it differs between local, preview and prod projects); the
--      grant above is what stops arbitrary values, this is the backstop.
--   3. avatars bucket: 5 MB cap and JPEG / PNG / WebP only, enforced by
--      Storage itself for every upload path.
--
-- Idempotent. Safe to re-run. Depends on 0001_init.sql.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Column grants
-- ---------------------------------------------------------------------------
revoke insert, update on public.profiles from anon, authenticated;

grant update (username, display_name, bio, signature_lenses, is_private)
  on public.profiles to authenticated;

-- handle_new_user (SECURITY DEFINER) is the normal insert path; this keeps
-- profiles_insert_self usable as defense in depth without opening
-- avatar_url or is_private on insert.
grant insert (id, username, display_name) on public.profiles to authenticated;

grant insert, update on public.profiles to service_role;

-- ---------------------------------------------------------------------------
-- 2. avatar_url shape
-- Added NOT VALID so the migration can't fail on rows that predate it, then
-- validated immediately when every existing row already conforms (the
-- normal case: avatar_url has only ever been set by the upload action).
-- If validation is skipped, the NOTICE says so; fix or null those rows and
-- run: alter table public.profiles validate constraint profiles_avatar_url_own_folder;
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_avatar_url_own_folder;

alter table public.profiles
  add constraint profiles_avatar_url_own_folder
  check (
    avatar_url is null
    or avatar_url ~ (
      '^https?://[^/?#]+/storage/v1/object/public/avatars/'
      || id::text
      || '/[A-Za-z0-9._-]+$'
    )
  ) not valid;

do $$
begin
  if not exists (
    select 1 from public.profiles
     where avatar_url is not null
       and avatar_url !~ (
         '^https?://[^/?#]+/storage/v1/object/public/avatars/'
         || id::text
         || '/[A-Za-z0-9._-]+$'
       )
  ) then
    alter table public.profiles validate constraint profiles_avatar_url_own_folder;
  else
    raise notice 'profiles_avatar_url_own_folder left NOT VALID: existing rows violate it';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Bucket limits (mirrors MAX_AVATAR_BYTES / sniffed types in
--    src/app/(app)/settings/actions.ts)
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit    = 5 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'avatars';
