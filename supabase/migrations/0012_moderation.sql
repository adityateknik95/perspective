-- ---------------------------------------------------------------------------
-- 0012_moderation.sql
-- Perspective — act on reports: hide content, track report status.
--
-- 0004 created reports as a write-only sink with nothing to act on it.
-- This adds the minimum needed for an admin to review and hide content:
--
--   perspectives.hidden_at / hidden_by
--   responses.hidden_at    / hidden_by
--     Set only by the service role (the /admin/reports actions; who counts
--     as an admin is the ADMIN_USER_IDS env list, which the database can't
--     see — hence service-role writes rather than a DB admin role). Neither
--     column is in the browser role's UPDATE grants (0006 / 0008), so an
--     author can't unhide their own content.
--
--   Product decision: the author still sees hidden content, flagged.
--     Hidden perspective → invisible to everyone but its author (RLS).
--     Hidden response    → stays in the thread so replies keep their place,
--                          but nobody except its author gets the body.
--
--   Response bodies, generally. 0004's select policy returns soft-deleted
--   responses (the thread keeps its shape) and the UI merely *displayed*
--   "[removed]" — the original text was still readable through PostgREST.
--   A hidden response would leak the same way. RLS filters rows, not
--   columns, so:
--     - anon / authenticated lose SELECT on body and body_plaintext;
--     - threads are read through get_response_thread(), which applies the
--       same visibility rule and returns body only when the response is
--       live, or hidden but yours.
--
--   reports
--     status (open / actioned / dismissed), resolved_at, resolved_by.
--     One report per reporter per target (re-reporting is a no-op).
--     You can only report something you can see, and the browser role can
--     insert only (reporter_id, target_type, target_id, reason) — it can't
--     file a report pre-dismissed.
--
-- Idempotent. Safe to re-run. Depends on 0008_social_visibility.sql.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.perspectives
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references public.profiles(id) on delete set null;

alter table public.responses
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references public.profiles(id) on delete set null;

alter table public.reports
  add column if not exists status      text not null default 'open',
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports
  add constraint reports_status_check
  check (status in ('open', 'actioned', 'dismissed'));

create unique index if not exists reports_one_per_reporter_target
  on public.reports (reporter_id, target_type, target_id);

create index if not exists reports_open_created_idx
  on public.reports (created_at desc)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- Visibility: hidden perspectives are owner-only.
-- Redefines 0007's helper and policy with one extra condition; everything
-- that calls perspective_is_visible() (reactions, responses, resonances,
-- profile_cards) picks it up.
-- ---------------------------------------------------------------------------
create or replace function public.perspective_is_visible(p_perspective_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perspectives p
     where p.id = p_perspective_id
       and (
         (auth.uid() is not null and p.user_id = auth.uid())
         or (
           p.is_draft = false
           and p.is_private = false
           and p.hidden_at is null
           and public.is_profile_public(p.user_id)
         )
       )
  );
$$;

drop policy if exists "perspectives_select_visible" on public.perspectives;

create policy "perspectives_select_visible" on public.perspectives
  for select using (
    user_id = auth.uid()
    or (
      is_draft = false
      and is_private = false
      and hidden_at is null
      and public.is_profile_public(user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Response bodies: column-level SELECT.
-- ---------------------------------------------------------------------------
revoke select on public.responses from anon, authenticated;
grant select (
  id, perspective_id, user_id, parent_response_id,
  is_deleted, hidden_at, created_at, updated_at
) on public.responses to anon, authenticated;
grant select on public.responses to service_role;

-- One row per response on the thread, author card joined, body masked.
-- SECURITY DEFINER because the caller can no longer read body directly; the
-- WHERE clause re-applies responses_select_visible (0008) so it returns
-- exactly the rows the caller could already see.
create or replace function public.get_response_thread(p_perspective_id uuid)
returns table (
  id                   uuid,
  perspective_id       uuid,
  parent_response_id   uuid,
  body                 text,
  is_deleted           boolean,
  is_hidden            boolean,
  created_at           timestamptz,
  updated_at           timestamptz,
  author_id            uuid,
  author_username      text,
  author_display_name  text,
  author_avatar_url    text
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (select auth.uid() as uid),
  rows as (
    select r.*,
           (r.user_id is not null and r.user_id = (select uid from viewer)) as mine,
           -- What a reader may see of this row's content and author:
           --   deleted            → nothing
           --   hidden, not yours  → nothing
           (not r.is_deleted
            and (r.hidden_at is null
                 or (r.user_id is not null and r.user_id = (select uid from viewer)))) as readable
      from public.responses r
     where r.perspective_id = p_perspective_id
       and (
         public.perspective_is_visible(r.perspective_id)
         or (r.user_id is not null and r.user_id = (select uid from viewer))
       )
  )
  select
    rows.id,
    rows.perspective_id,
    rows.parent_response_id,
    case when rows.readable then rows.body end,
    rows.is_deleted,
    rows.hidden_at is not null,
    rows.created_at,
    rows.updated_at,
    case when rows.readable then pr.id end,
    case when rows.readable then pr.username::text end,
    case when rows.readable then pr.display_name end,
    case when rows.readable then pr.avatar_url end
    from rows
    left join public.profiles pr on pr.id = rows.user_id
   order by rows.created_at asc;
$$;

revoke all on function public.get_response_thread(uuid) from public;
grant execute on function public.get_response_thread(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
drop policy if exists "reports_insert_self" on public.reports;

create policy "reports_insert_self" on public.reports
  for insert with check (
    reporter_id = auth.uid()
    and (
      (target_type = 'perspective' and public.perspective_is_visible(target_id))
      or (target_type = 'response' and public.response_is_visible(target_id))
    )
  );

revoke insert, update on public.reports from anon, authenticated;
grant insert (reporter_id, target_type, target_id, reason) on public.reports to authenticated;
grant insert, update on public.reports to service_role;
