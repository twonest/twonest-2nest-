-- Migration: Add custom split fields to expenses table
-- This adds support for custom split ratios on individual expenses

-- Check if the column exists before adding (to avoid errors on re-run)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'expenses' and column_name = 'custom_split'
  ) then
    alter table public.expenses add column custom_split boolean default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'expenses' and column_name = 'custom_parent1_pct'
  ) then
    alter table public.expenses add column custom_parent1_pct numeric(5,2);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'expenses' and column_name = 'custom_parent2_pct'
  ) then
    alter table public.expenses add column custom_parent2_pct numeric(5,2);
  end if;
end $$;
