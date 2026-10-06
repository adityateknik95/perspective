-- ---------------------------------------------------------------------------
-- 0013_moderation_audit_columns.sql
-- Perspective — fix 0012: audit columns must not be foreign keys to profiles.
--
-- Before: 0012 declared perspectives.hidden_by, responses.hidden_by and
--         reports.resolved_by as `references public.profiles(id)`. PostgREST
--         treats every FK as an embeddable relationship, so perspectives
--         suddenly had TWO paths to profiles (user_id and hidden_by). Every
--         un-hinted `profiles!inner(...)` embed from perspectives — the read
--         view, film / lens pages, the Following tab, the reaction action,
--         share cards — failed with PGRST201 ("more than one relationship
--         was found"), and those pages rendered empty or 404.
--
-- After:  the three columns stay (same name, same uuid type, same values) as
--         plain audit fields with no FK. Consequences, all acceptable:
--           - no ambiguity: user_id is again the only perspectives→profiles
--             (and reporter_id the only reports→profiles) relationship;
--           - if an admin deletes their account, these keep the old id
--             instead of being nulled — it's a record of who acted, and the
--             admin list (ADMIN_USER_IDS) lives outside the database anyway.
--
-- Rule going forward: a second column on a table that points at profiles is
-- an audit field, not a foreign key, unless every embed of that table is
-- FK-hinted. scripts/verify-social-rls.mjs pins the app's embed shapes.
--
-- Idempotent. Safe to re-run. Depends on 0012_moderation.sql.
-- ---------------------------------------------------------------------------

alter table public.perspectives drop constraint if exists perspectives_hidden_by_fkey;
alter table public.responses    drop constraint if exists responses_hidden_by_fkey;
alter table public.reports      drop constraint if exists reports_resolved_by_fkey;

comment on column public.perspectives.hidden_by is
  'Admin (auth user id) who hid this. Audit only — intentionally not an FK (see 0013).';
comment on column public.responses.hidden_by is
  'Admin (auth user id) who hid this. Audit only — intentionally not an FK (see 0013).';
comment on column public.reports.resolved_by is
  'Admin (auth user id) who resolved this. Audit only — intentionally not an FK (see 0013).';
