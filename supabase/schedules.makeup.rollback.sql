-- Reverses the make-up-fixture additions in schedules.sql.
-- Resolve or remove make-up fixtures first so this rollback never silently loses their type/link.
do $$
begin
  if exists (select 1 from public.league_matches where fixture_type = 'makeup') then
    raise exception 'Cannot roll back make-up fixture columns while make-up fixtures exist.';
  end if;
end $$;

drop index if exists public.league_matches_parent_match_idx;

alter table public.league_matches
  drop constraint if exists league_matches_fixture_type_check;

alter table public.league_matches
  drop column if exists parent_match_id,
  drop column if exists fixture_type;
