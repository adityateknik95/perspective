-- ---------------------------------------------------------------------------
-- 0004_social.sql
-- Perspective — the social layer.
--
--   reactions             — typed (5 verbs), one-per-user-per-perspective
--   responses             — public conversation threads, one level of nesting
--   response_resonances   — simple "+1" on a response (untyped)
--   follows               — directed graph; public; no requests in v1
--   notifications         — recipient-private inbox; populated by triggers
--   reports               — write-only sink for moderation
--
--   get_perspective_reaction_summary(perspective_id)
--   get_feed_for_user(user_id, cursor_published_at, cursor_id, page_size)
--
-- Triggers populate notifications synchronously after INSERTs on reactions,
-- responses, and follows. They run as SECURITY DEFINER so they can write
-- into notifications regardless of caller RLS, with search_path pinned to
-- public to avoid privilege-escalation games.
--
-- Reaction notifications dedupe per (recipient, actor, perspective) via a
-- partial unique index — react → unreact → react bumps the existing row's
-- timestamp instead of creating three. Same shape for follows. Responses
-- never dedupe (each response is a discrete event).
--
-- Idempotent. Paste the entire file into the Supabase SQL Editor and run.
-- Depends on 0002_films_perspectives.sql (perspectives, films, profiles).
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- reactions
-- ---------------------------------------------------------------------------

create table if not exists public.reactions (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles(id)     on delete cascade,
  perspective_id  uuid        not null references public.perspectives(id) on delete cascade,
  reaction_type   text        not null
                              check (reaction_type in (
                                'moved', 'changed_my_mind', 'recognized_myself',
                                'saw_it_differently', 'stayed_with_me'
                              )),
  created_at      timestamptz not null default now(),

  -- One reaction per user per perspective. Switching types is an UPDATE.
  constraint reactions_user_perspective_unique unique (user_id, perspective_id)
);

create index if not exists reactions_perspective_type_idx
  on public.reactions (perspective_id, reaction_type);

alter table public.reactions enable row level security;

drop policy if exists "reactions_select_public" on public.reactions;
drop policy if exists "reactions_insert_self"   on public.reactions;
drop policy if exists "reactions_update_self"   on public.reactions;
drop policy if exists "reactions_delete_self"   on public.reactions;

-- Reactions are public. The "did you react?" check is a client-side filter
-- on the rows where user_id = auth.uid().
create policy "reactions_select_public" on public.reactions
  for select using (true);

-- Privacy/draft enforcement happens in the server action, not RLS — RLS
-- can't read the perspective's flags efficiently without a subquery on
-- every insert, and we already have the action gate.
create policy "reactions_insert_self" on public.reactions
  for insert with check (user_id = auth.uid());

create policy "reactions_update_self" on public.reactions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "reactions_delete_self" on public.reactions
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- responses
-- One level of nesting only. Enforced in the server action — the column
-- allows arbitrary depth structurally, but createResponse rejects an
-- attempt to set parent_response_id when the parent already has one.
-- ---------------------------------------------------------------------------

create table if not exists public.responses (
  id                  uuid        primary key default gen_random_uuid(),
  perspective_id      uuid        not null references public.perspectives(id) on delete cascade,
  user_id             uuid        not null references public.profiles(id)     on delete cascade,
  parent_response_id  uuid                 references public.responses(id)    on delete cascade,
  body                text        not null
                                  check (char_length(body) between 1 and 2000),
  body_plaintext      text        not null,
  is_deleted          boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists responses_perspective_created_idx
  on public.responses (perspective_id, created_at);

create index if not exists responses_parent_idx
  on public.responses (parent_response_id)
  where parent_response_id is not null;

alter table public.responses enable row level security;

drop policy if exists "responses_select_visible" on public.responses;
drop policy if exists "responses_insert_self"    on public.responses;
drop policy if exists "responses_update_self"    on public.responses;
drop policy if exists "responses_delete_self"    on public.responses;

-- Visible if the parent perspective is publicly visible, OR you authored
-- the response (so you can still see your own work even if the perspective
-- got hidden after the fact). Soft-deleted rows are returned too — the UI
-- substitutes "[removed]" so the thread structure is preserved.
create policy "responses_select_visible" on public.responses
  for select using (
    exists (
      select 1 from public.perspectives p
      where p.id = responses.perspective_id
        and p.is_draft = false
        and p.is_private = false
    )
    or user_id = auth.uid()
  );

create policy "responses_insert_self" on public.responses
  for insert with check (user_id = auth.uid());

-- Author can edit body OR mark deleted. We don't UPDATE response_resonances
-- through this policy.
create policy "responses_update_self" on public.responses
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Hard delete is allowed too (separate from soft-delete) for moderation
-- recoveries; the app uses soft-delete via UPDATE.
create policy "responses_delete_self" on public.responses
  for delete using (user_id = auth.uid());

drop trigger if exists responses_set_updated_at on public.responses;
create trigger responses_set_updated_at
  before update on public.responses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- response_resonances
-- "+1" on a response. No types, no dedup — UNIQUE PK does the work.
-- ---------------------------------------------------------------------------

create table if not exists public.response_resonances (
  response_id  uuid        not null references public.responses(id) on delete cascade,
  user_id      uuid        not null references public.profiles(id)  on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (response_id, user_id)
);

create index if not exists response_resonances_response_idx
  on public.response_resonances (response_id);

alter table public.response_resonances enable row level security;

drop policy if exists "response_resonances_select_public" on public.response_resonances;
drop policy if exists "response_resonances_insert_self"   on public.response_resonances;
drop policy if exists "response_resonances_delete_self"   on public.response_resonances;

create policy "response_resonances_select_public" on public.response_resonances
  for select using (true);

create policy "response_resonances_insert_self" on public.response_resonances
  for insert with check (user_id = auth.uid());

create policy "response_resonances_delete_self" on public.response_resonances
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- follows
-- Directed graph. follower_id follows following_id. PK is the pair.
-- ---------------------------------------------------------------------------

create table if not exists public.follows (
  follower_id   uuid        not null references public.profiles(id) on delete cascade,
  following_id  uuid        not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index if not exists follows_following_idx
  on public.follows (following_id);

alter table public.follows enable row level security;

drop policy if exists "follows_select_public" on public.follows;
drop policy if exists "follows_insert_self"   on public.follows;
drop policy if exists "follows_delete_self"   on public.follows;

create policy "follows_select_public" on public.follows
  for select using (true);

create policy "follows_insert_self" on public.follows
  for insert with check (follower_id = auth.uid());

create policy "follows_delete_self" on public.follows
  for delete using (follower_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notifications
-- Inbox. Triggers populate this; users can only read/update their own.
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles(id)     on delete cascade, -- recipient
  actor_id        uuid        not null references public.profiles(id)     on delete cascade, -- who did it
  type            text        not null
                              check (type in ('reaction', 'response', 'follow', 'mention')),
  perspective_id  uuid                 references public.perspectives(id) on delete cascade,
  response_id     uuid                 references public.responses(id)    on delete cascade,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

-- Dedup keys for triggers. Reactions and follows collapse repeats; responses
-- never collapse (each response is a separate event).
create unique index if not exists notifications_reaction_dedup
  on public.notifications (user_id, actor_id, perspective_id)
  where type = 'reaction';

create unique index if not exists notifications_follow_dedup
  on public.notifications (user_id, actor_id)
  where type = 'follow';

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_self" on public.notifications;
drop policy if exists "notifications_update_self" on public.notifications;
drop policy if exists "notifications_delete_self" on public.notifications;

create policy "notifications_select_self" on public.notifications
  for select using (user_id = auth.uid());

-- Only update is mark-as-read (set read_at). The WITH CHECK keeps user_id
-- unchanged so a user can't re-target someone else's notification.
create policy "notifications_update_self" on public.notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications_delete_self" on public.notifications
  for delete using (user_id = auth.uid());

-- INSERT has no policy — only SECURITY DEFINER trigger functions and the
-- service role can write. This is intentional.

-- ---------------------------------------------------------------------------
-- reports
-- Write-only sink. Moderation tooling consumes via service role.
-- ---------------------------------------------------------------------------

create table if not exists public.reports (
  id            uuid        primary key default gen_random_uuid(),
  reporter_id   uuid        not null references public.profiles(id) on delete cascade,
  target_type   text        not null check (target_type in ('perspective', 'response')),
  target_id     uuid        not null,
  reason        text        not null check (char_length(reason) between 1 and 500),
  created_at    timestamptz not null default now()
);

create index if not exists reports_created_idx
  on public.reports (created_at desc);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_self" on public.reports;
-- No SELECT policy: reporters cannot read their own reports back. Service
-- role bypasses RLS for moderation review.
create policy "reports_insert_self" on public.reports
  for insert with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Notification triggers
-- All run SECURITY DEFINER with search_path locked to public so they can
-- write to notifications without RLS getting in the way.
-- ---------------------------------------------------------------------------

-- Reactions: notify the perspective author. Skip if reactor is the author.
-- Dedupe via the partial unique index above; bump created_at + clear read_at.
create or replace function public.notify_on_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
begin
  select user_id into author_id
    from public.perspectives
   where id = new.perspective_id;

  if author_id is null or author_id = new.user_id then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, perspective_id)
  values (author_id, new.user_id, 'reaction', new.perspective_id)
  on conflict (user_id, actor_id, perspective_id) where type = 'reaction'
  do update set created_at = now(), read_at = null;

  return new;
end;
$$;

drop trigger if exists reactions_notify on public.reactions;
create trigger reactions_notify
  after insert or update of reaction_type on public.reactions
  for each row execute function public.notify_on_reaction();

-- Responses: notify the perspective author, AND the parent response author
-- if this is a reply. Skip self-notifications, dedupe across the two
-- (so author replying to a comment on their own piece doesn't notify them
-- twice — they wouldn't be notified at all in that case).
create or replace function public.notify_on_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  perspective_author uuid;
  parent_author      uuid;
begin
  select user_id into perspective_author
    from public.perspectives
   where id = new.perspective_id;

  if new.parent_response_id is not null then
    select user_id into parent_author
      from public.responses
     where id = new.parent_response_id;
  end if;

  -- Notify perspective author (skip self).
  if perspective_author is not null and perspective_author <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, perspective_id, response_id)
    values (perspective_author, new.user_id, 'response', new.perspective_id, new.id);
  end if;

  -- Notify parent response author (skip self, skip if same as perspective
  -- author — already notified above).
  if parent_author is not null
     and parent_author <> new.user_id
     and parent_author is distinct from perspective_author then
    insert into public.notifications (user_id, actor_id, type, perspective_id, response_id)
    values (parent_author, new.user_id, 'response', new.perspective_id, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists responses_notify on public.responses;
create trigger responses_notify
  after insert on public.responses
  for each row execute function public.notify_on_response();

-- Follows: notify the followed user. No self-follows possible (CHECK
-- constraint), so we don't need a same-user guard. Dedupe via partial
-- unique index — unfollow → follow bumps the existing row.
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow')
  on conflict (user_id, actor_id) where type = 'follow'
  do update set created_at = now(), read_at = null;

  return new;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- ---------------------------------------------------------------------------
-- RPC: get_perspective_reaction_summary
-- Returns a jsonb shape: {moved: 0, changed_my_mind: 0, recognized_myself: 0,
--                        saw_it_differently: 0, stayed_with_me: 0, total: 0}.
-- All five keys are always present (zero-filled), so the client never has to
-- guard for missing entries.
-- ---------------------------------------------------------------------------

create or replace function public.get_perspective_reaction_summary(p_perspective_id uuid)
returns jsonb
language sql
stable
as $$
  with counts as (
    select reaction_type, count(*)::int as n
      from public.reactions
     where perspective_id = p_perspective_id
     group by reaction_type
  )
  select jsonb_build_object(
    'moved',              coalesce((select n from counts where reaction_type = 'moved'), 0),
    'changed_my_mind',    coalesce((select n from counts where reaction_type = 'changed_my_mind'), 0),
    'recognized_myself',  coalesce((select n from counts where reaction_type = 'recognized_myself'), 0),
    'saw_it_differently', coalesce((select n from counts where reaction_type = 'saw_it_differently'), 0),
    'stayed_with_me',     coalesce((select n from counts where reaction_type = 'stayed_with_me'), 0),
    'total',              coalesce((select sum(n) from counts), 0)
  );
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_feed_for_user
-- Chronological feed of published, non-private perspectives from people the
-- user follows. Cursor on (published_at desc, id desc) for stable pagination
-- across ties. Returns one row per perspective with reaction summary +
-- response count + author profile bits joined, to avoid client-side N+1.
-- Pass null cursors on the first page.
-- ---------------------------------------------------------------------------

create or replace function public.get_feed_for_user(
  p_user_id              uuid,
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
     and p.user_id in (select following_id from public.follows where follower_id = p_user_id)
     -- Keyset cursor: rows strictly after (published_at, id) in desc order.
     and (
       p_cursor_published_at is null
       or (p.published_at, p.id) < (p_cursor_published_at, p_cursor_id)
     )
   order by p.published_at desc, p.id desc
   limit greatest(1, least(p_page_size, 50));
$$;
