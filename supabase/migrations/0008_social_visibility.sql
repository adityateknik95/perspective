-- ---------------------------------------------------------------------------
-- 0008_social_visibility.sql
-- Perspective — move the reaction / response rules into the database.
--
-- Before: 0004's insert policies only checked user_id = auth.uid(). The
--         "is this perspective reactable?" and "is this a valid parent?"
--         rules lived in the server actions, so a direct PostgREST call
--         could react to a draft, respond to a private piece, graft a reply
--         onto another perspective's thread, or nest replies arbitrarily.
--         reactions and response_resonances were SELECT-able by anyone,
--         which leaked activity on drafts and private pieces.
--
-- After:  every policy asks perspective_is_visible() from 0007 — the caller
--         owns the perspective, or it is published + not private + by a
--         public profile.
--
--   reactions            select / insert / update require a visible target.
--   responses            insert requires a visible target AND a valid parent
--                        (same perspective, top level). select keeps 0004's
--                        "or you wrote it" escape hatch.
--                        Column grants: INSERT only the content columns (no
--                        forged created_at / is_deleted / id), UPDATE only
--                        body / body_plaintext / is_deleted (a response can't
--                        be moved to another thread after the fact).
--   response_resonances  select requires the response's perspective to be
--                        visible; insert also requires the response to be
--                        live (not soft-deleted).
--
-- reactions keep table-level UPDATE: the app upserts, and PostgREST's
-- upsert writes every supplied column in ON CONFLICT DO UPDATE, so a column
-- grant on reaction_type alone would break it. The WITH CHECK below is what
-- stops an update from re-pointing a reaction at a hidden perspective.
--
-- Idempotent. Safe to re-run. Depends on 0007_profile_privacy.sql.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER for the same reasons as 0007's: one place for
-- the rule, no nested RLS, no recursion when a responses policy has to read
-- responses).
-- ---------------------------------------------------------------------------

-- A reply's parent must exist, be on the same perspective, and be top
-- level. NULL parent = top-level response = always fine.
create or replace function public.response_parent_ok(
  p_parent_response_id uuid,
  p_perspective_id     uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_parent_response_id is null
      or exists (
        select 1 from public.responses parent
         where parent.id = p_parent_response_id
           and parent.perspective_id = p_perspective_id
           and parent.parent_response_id is null
      );
$$;

-- The response exists and its perspective is visible to the caller.
-- p_require_live additionally rejects soft-deleted responses (you can still
-- see "[removed]" in a thread, but you can't resonate with it).
create or replace function public.response_is_visible(
  p_response_id  uuid,
  p_require_live boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.responses r
     where r.id = p_response_id
       and (not p_require_live or r.is_deleted = false)
       and public.perspective_is_visible(r.perspective_id)
  );
$$;

revoke all on function public.response_parent_ok(uuid, uuid)       from public;
revoke all on function public.response_is_visible(uuid, boolean)   from public;
grant execute on function public.response_parent_ok(uuid, uuid)     to anon, authenticated, service_role;
grant execute on function public.response_is_visible(uuid, boolean) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- reactions
-- ---------------------------------------------------------------------------
drop policy if exists "reactions_select_public"  on public.reactions;
drop policy if exists "reactions_select_visible" on public.reactions;
drop policy if exists "reactions_insert_self"    on public.reactions;
drop policy if exists "reactions_update_self"    on public.reactions;

-- Counts and "did you react?" both read through this, so a hidden piece
-- reports zero reactions to everyone but its author.
create policy "reactions_select_visible" on public.reactions
  for select using (public.perspective_is_visible(perspective_id));

create policy "reactions_insert_self" on public.reactions
  for insert with check (
    user_id = auth.uid()
    and public.perspective_is_visible(perspective_id)
  );

create policy "reactions_update_self" on public.reactions
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.perspective_is_visible(perspective_id)
  );

-- reactions_delete_self (0004) is unchanged: you can always take back your
-- own reaction, even if the piece has since gone private.

-- ---------------------------------------------------------------------------
-- responses
-- ---------------------------------------------------------------------------
drop policy if exists "responses_select_visible" on public.responses;
drop policy if exists "responses_insert_self"    on public.responses;

create policy "responses_select_visible" on public.responses
  for select using (
    public.perspective_is_visible(perspective_id)
    or user_id = auth.uid()
  );

create policy "responses_insert_self" on public.responses
  for insert with check (
    user_id = auth.uid()
    and public.perspective_is_visible(perspective_id)
    and public.response_parent_ok(parent_response_id, perspective_id)
  );

revoke insert, update on public.responses from anon, authenticated;
grant insert (perspective_id, user_id, parent_response_id, body, body_plaintext)
  on public.responses to authenticated;
grant update (body, body_plaintext, is_deleted)
  on public.responses to authenticated;
grant insert, update on public.responses to service_role;

-- ---------------------------------------------------------------------------
-- response_resonances
-- ---------------------------------------------------------------------------
drop policy if exists "response_resonances_select_public"  on public.response_resonances;
drop policy if exists "response_resonances_select_visible" on public.response_resonances;
drop policy if exists "response_resonances_insert_self"    on public.response_resonances;

create policy "response_resonances_select_visible" on public.response_resonances
  for select using (public.response_is_visible(response_id));

create policy "response_resonances_insert_self" on public.response_resonances
  for insert with check (
    user_id = auth.uid()
    and public.response_is_visible(response_id, true)
  );

-- response_resonances_delete_self (0004) is unchanged.
