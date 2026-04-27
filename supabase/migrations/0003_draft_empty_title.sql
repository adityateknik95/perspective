-- ---------------------------------------------------------------------------
-- 0003_draft_empty_title.sql
-- Allow drafts to have an empty title. The title is still validated (1-120)
-- at publish time via the perspectives_publish_shape constraint.
--
-- Before: title check enforced 1-120 at the column level, which made
--         INSERT with an empty title impossible. Our draft-creation path
--         (src/app/(app)/write/new/page.tsx) deliberately creates rows with
--         title = '' so the user can fill it in while writing.
--
-- After:  column-level check caps at 120. Publish path (is_draft = false)
--         additionally requires title >= 1 char via publish_shape.
--
-- Idempotent. Safe to re-run.
-- ---------------------------------------------------------------------------

-- Relax the column-level title check to an upper bound only.
alter table public.perspectives
  drop constraint if exists perspectives_title_check;

alter table public.perspectives
  add constraint perspectives_title_check
  check (char_length(title) <= 120);

-- Give the column a default so future INSERTs can omit title.
alter table public.perspectives
  alter column title set default '';

-- Re-form the publish_shape check to include the 1-120 title requirement
-- that used to live on the column.
alter table public.perspectives
  drop constraint if exists perspectives_publish_shape;

alter table public.perspectives
  add constraint perspectives_publish_shape
  check (
    is_draft
    or (
      published_at is not null
      and char_length(title) between 1 and 120
      and cardinality(lens_tags) between 1 and 3
    )
  );
