-- ---------------------------------------------------------------------------
-- 0007_profile_privacy.sql
-- Perspective — make profiles.is_private a real rule for perspectives.
--
-- Before: is_private only hid the profile row. A private user's published,
--         non-private pieces were hidden on list pages purely because those
--         queries happened to use profiles!inner — anyone calling PostgREST
--         directly (select * from perspectives) could still read them.
--
-- After:  perspectives_select_visible requires the author's profile to be
--         public, unless you are the author. Two SECURITY DEFINER helpers
--         carry the rule so every policy (here and in 0008) asks the same
--         question the same way:
--
--           is_profile_public(user_id)    — profile exists and isn't private
--           perspective_is_visible(id)    — caller owns it, OR it is
--                                           published + not private + by a
--                                           public profile
--
--         They're SECURITY DEFINER so a policy on one table can consult
--         another without nesting that table's RLS (and without recursion
--         when a policy on X asks about X). search_path is pinned and they
--         return a single boolean, so they leak nothing beyond what the
--         policy itself decides.
--
-- Responses by private authors (product decision): their responses on other
-- people's public pieces stay visible with name + avatar — the profile is
-- private, the comment was public. profile_cards exposes ONLY
-- (id, username, display_name, avatar_url), and only for a private profile
-- that has a response on a perspective the caller can see, so private
-- profiles can't be enumerated through it. Soft-deleted responses count:
-- the thread keeps their slot ("[removed]") and the embed is !inner, so
-- dropping the card would drop the row and break the thread shape.
--
-- Idempotent. Safe to re-run. Depends on 0004_social.sql.
-- ---------------------------------------------------------------------------

create or replace function public.is_profile_public(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = p_user_id
       and is_private = false
  );
$$;

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
           and public.is_profile_public(p.user_id)
         )
       )
  );
$$;

revoke all on function public.is_profile_public(uuid)      from public;
revoke all on function public.perspective_is_visible(uuid) from public;
grant execute on function public.is_profile_public(uuid)      to anon, authenticated, service_role;
grant execute on function public.perspective_is_visible(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- perspectives: owner always; everyone else only published, non-private
-- pieces by public profiles.
-- ---------------------------------------------------------------------------
drop policy if exists "perspectives_select_visible" on public.perspectives;

create policy "perspectives_select_visible" on public.perspectives
  for select using (
    user_id = auth.uid()
    or (
      is_draft = false
      and is_private = false
      and public.is_profile_public(user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- profile_cards
-- The minimum needed to attribute a response: no bio, no lenses, no flags.
-- Runs with the view owner's rights (it has to read private rows to show a
-- private responder's name), so the WHERE clause is the whole access rule.
-- PostgREST embeds it through responses.user_id → profiles.id, e.g.
--   responses?select=*,author:profile_cards!responses_user_id_fkey!inner(...)
-- The FK hint is required: response_resonances is a second, many-to-many
-- path between responses and profiles, so PostgREST can't pick on its own.
-- ---------------------------------------------------------------------------
create or replace view public.profile_cards
with (security_invoker = false)
as
  select pr.id, pr.username, pr.display_name, pr.avatar_url
    from public.profiles pr
   where pr.is_private = false
      or pr.id = auth.uid()
      or exists (
        select 1 from public.responses r
         where r.user_id = pr.id
           and public.perspective_is_visible(r.perspective_id)
      );

revoke all on public.profile_cards from public, anon, authenticated;
grant select on public.profile_cards to anon, authenticated, service_role;
