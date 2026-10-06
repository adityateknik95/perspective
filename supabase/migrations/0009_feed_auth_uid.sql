-- ---------------------------------------------------------------------------
-- 0009_feed_auth_uid.sql
-- Perspective — get_feed_for_user reads the caller from the JWT.
--
-- Before: get_feed_for_user(p_user_id, ...) accepted any user id, so anyone
--         with the anon key could read another user's follow graph as a
--         ready-made feed ("what does X follow, newest first").
--
-- After:  the p_user_id parameter is gone; the function uses auth.uid().
--         Signed-out callers get nothing (auth.uid() is null, so the
--         follows subquery is empty) and anon loses EXECUTE anyway.
--         Still SECURITY INVOKER, so perspectives' RLS (0007) applies on
--         top of the explicit filters.
--
-- The old signature is dropped rather than overloaded: leaving it would
-- leave the hole. No app code calls the RPC yet (the Following tab queries
-- perspectives directly), so there's no caller to migrate.
--
-- Idempotent. Safe to re-run. Depends on 0004_social.sql.
-- ---------------------------------------------------------------------------

drop function if exists public.get_feed_for_user(uuid, timestamptz, uuid, int);

create or replace function public.get_feed_for_user(
  p_cursor_published_at  timestamptz default null,
  p_cursor_id            uuid        default null,
  p_page_size            int         default 20
)
returns table (
  id                    uuid,
  title                 text,
  subtitle              text,
  body_plaintext        text,
  reading_time_minutes  int,
  lens_tags             text[],
  published_at          timestamptz,
  film_tmdb_id          int,
  film_title            text,
  film_year             int,
  film_poster_path      text,
  author_username       text,
  author_display_name   text,
  author_avatar_url     text,
  reaction_summary      jsonb,
  response_count        int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.title,
    p.subtitle,
    p.body_plaintext,
    p.reading_time_minutes,
    p.lens_tags,
    p.published_at,
    f.tmdb_id          as film_tmdb_id,
    f.title            as film_title,
    f.year             as film_year,
    f.poster_path      as film_poster_path,
    pr.username        as author_username,
    pr.display_name    as author_display_name,
    pr.avatar_url      as author_avatar_url,
    public.get_perspective_reaction_summary(p.id) as reaction_summary,
    (select count(*)::int
       from public.responses r
      where r.perspective_id = p.id and r.is_deleted = false) as response_count
    from public.perspectives p
    join public.films    f  on f.id  = p.film_id
    join public.profiles pr on pr.id = p.user_id
   where p.is_draft   = false
     and p.is_private = false
     and p.user_id in (select following_id from public.follows where follower_id = auth.uid())
     -- Keyset cursor: rows strictly after (published_at, id) in desc order.
     and (
       p_cursor_published_at is null
       or (p.published_at, p.id) < (p_cursor_published_at, p_cursor_id)
     )
   order by p.published_at desc, p.id desc
   limit greatest(1, least(p_page_size, 50));
$$;

revoke all on function public.get_feed_for_user(timestamptz, uuid, int) from public, anon;
grant execute on function public.get_feed_for_user(timestamptz, uuid, int) to authenticated, service_role;
