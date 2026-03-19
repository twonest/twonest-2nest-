-- Remove any CHECK constraint on grocery category field.
-- Run this script in Supabase SQL editor.

do $$
declare
  current_constraint record;
begin
  for current_constraint in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'grocery_items'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%category%'
  loop
    execute format('alter table public.grocery_items drop constraint if exists %I', current_constraint.conname);
  end loop;
end
$$;
