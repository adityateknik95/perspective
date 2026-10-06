-- ---------------------------------------------------------------------------
-- 0011_account_deletion.sql
-- Perspective — deleting an account must not delete other people's words.
--
-- Deleting an auth user cascades: auth.users → profiles → perspectives,
-- reactions, responses, follows, notifications, reports. That's the intent
-- for the user's own content. But responses.parent_response_id also
-- cascades, so deleting a user's top-level response silently deleted every
-- reply other people had written under it.
--
-- Product decision: keep those threads. Before the profile row goes, any
-- top-level response of theirs that has a reply from someone else is
-- detached instead of deleted:
--   user_id   → NULL       (no link back to the deleted account)
--   body      → '[deleted]' (their words are gone)
--   is_deleted → true       (the UI already renders this as "Removed")
-- Every other response of theirs, including their own replies, still
-- cascades away as before.
--
-- Doing this in a BEFORE DELETE trigger on profiles (rather than in the
-- app's delete-account action) means it also holds when a user is deleted
-- from the Supabase dashboard or by support tooling. FK cascades run as
-- AFTER actions, so the detach always lands first.
--
-- A NULL author was chosen over a placeholder "deleted user" profile: a
-- profile needs a real auth.users row, and a fake account is one more
-- thing that can be signed into, followed, or reported.
--
-- Idempotent. Safe to re-run. Depends on 0004_social.sql.
-- ---------------------------------------------------------------------------

alter table public.responses alter column user_id drop not null;

create or replace function public.detach_threaded_responses_on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.responses r
     set user_id        = null,
         body           = '[deleted]',
         body_plaintext = '[deleted]',
         is_deleted     = true
   where r.user_id = old.id
     and r.parent_response_id is null
     and exists (
       select 1 from public.responses reply
        where reply.parent_response_id = r.id
          and reply.user_id is distinct from old.id
     );
  return old;
end;
$$;

revoke all on function public.detach_threaded_responses_on_profile_delete() from public;

drop trigger if exists profiles_detach_threaded_responses on public.profiles;
create trigger profiles_detach_threaded_responses
  before delete on public.profiles
  for each row execute function public.detach_threaded_responses_on_profile_delete();
