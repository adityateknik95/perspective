-- ---------------------------------------------------------------------------
-- 0006_perspective_write_guards.sql
-- Perspective — stop clients writing server-derived perspective columns.
--
-- Before: perspectives_update_self let an owner UPDATE any column through
--         PostgREST with the public anon key. That skipped the server action
--         entirely, so a signed-in user could store unsanitized HTML in body
--         (stored XSS on the read view), forge word_count / reading_time, or
--         flip is_draft / published_at without the publish-time validation.
--         perspectives_insert_self had the same hole on INSERT (a row could
--         be born published with any body).
--
-- After:  column-level privileges. RLS still decides WHICH rows a role may
--         touch; grants now decide WHICH columns.
--           authenticated INSERT → user_id, film_id only. Every other column
--                                  takes its default (an empty draft).
--           authenticated UPDATE → is_private only (the owner-menu toggle).
--         Everything else — title, subtitle, body, body_plaintext,
--         word_count, reading_time_minutes, lens_tags, is_draft,
--         published_at — is written only by the server (service role) after
--         sanitizing the HTML in Node. See src/lib/perspectives/writer.ts.
--
-- Why grants and not a SECURITY DEFINER RPC: sanitization runs in Node
-- (sanitize-html), not in Postgres. An RPC the browser can call would still
-- accept whatever HTML the caller sends, so it would only move the hole.
--
-- Also: published_at is write-once. The app already preserves it across
-- Published → Edit → Re-publish; the trigger below makes that a database
-- rule so no path (service role included) can backdate or move a piece.
--
-- Idempotent. Safe to re-run. Depends on 0002_films_perspectives.sql.
-- ---------------------------------------------------------------------------

-- Supabase's default privileges grant ALL on public tables to anon and
-- authenticated. Revoke the table-wide INSERT/UPDATE first, otherwise the
-- column grants below are shadowed by the broader table grant.
revoke insert, update on public.perspectives from anon, authenticated;

-- anon never writes perspectives (RLS would block it anyway — no auth.uid()).
-- authenticated gets exactly the columns the browser-facing paths need.
grant insert (user_id, film_id) on public.perspectives to authenticated;
grant update (is_private)       on public.perspectives to authenticated;

-- service_role keeps full access (it bypasses RLS but not grants, so make
-- the grant explicit rather than relying on the platform default).
grant insert, update on public.perspectives to service_role;

-- ---------------------------------------------------------------------------
-- published_at is write-once.
-- NULL → timestamp is allowed (first publish). Any change after that is not.
-- ---------------------------------------------------------------------------
create or replace function public.perspectives_published_at_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.published_at is not null
     and new.published_at is distinct from old.published_at then
    raise exception 'published_at is immutable once set'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists perspectives_published_at_immutable on public.perspectives;
create trigger perspectives_published_at_immutable
  before update of published_at on public.perspectives
  for each row execute function public.perspectives_published_at_immutable();
