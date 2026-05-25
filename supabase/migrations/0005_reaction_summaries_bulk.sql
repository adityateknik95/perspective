-- ---------------------------------------------------------------------------
-- 0005_reaction_summaries_bulk.sql
-- Bulk variant of get_perspective_reaction_summary for list views (profile
-- feeds, film pages). The single-id RPC is fine on the read view, but list
-- pages were doing a row-scan with .in() and aggregating in JS — workable at
-- 20 rows, slow at 200.
--
-- Returns one row per input id, with all five reaction types zero-filled.
-- Ids in p_ids that have no reactions still come back (total = 0) so callers
-- can blindly Map.get(id) without nullability dancing.
--
-- Idempotent. Depends on 0004_social.sql (public.reactions).
-- ---------------------------------------------------------------------------

create or replace function public.get_perspective_reaction_summaries(
  p_ids uuid[]
)
returns table (
  perspective_id      uuid,
  moved               int,
  changed_my_mind     int,
  recognized_myself   int,
  saw_it_differently  int,
  stayed_with_me      int,
  total               int
)
language sql
stable
as $$
  with input as (
    select unnest(p_ids) as perspective_id
  ),
  counts as (
    select
      r.perspective_id,
      r.reaction_type,
      count(*)::int as n
    from public.reactions r
    where r.perspective_id = any(p_ids)
    group by r.perspective_id, r.reaction_type
  )
  select
    i.perspective_id,
    coalesce(sum(case when c.reaction_type = 'moved'              then c.n end)::int, 0) as moved,
    coalesce(sum(case when c.reaction_type = 'changed_my_mind'    then c.n end)::int, 0) as changed_my_mind,
    coalesce(sum(case when c.reaction_type = 'recognized_myself'  then c.n end)::int, 0) as recognized_myself,
    coalesce(sum(case when c.reaction_type = 'saw_it_differently' then c.n end)::int, 0) as saw_it_differently,
    coalesce(sum(case when c.reaction_type = 'stayed_with_me'     then c.n end)::int, 0) as stayed_with_me,
    coalesce(sum(c.n)::int, 0) as total
  from input i
  left join counts c on c.perspective_id = i.perspective_id
  group by i.perspective_id;
$$;
