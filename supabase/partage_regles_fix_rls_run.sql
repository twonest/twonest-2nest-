-- Fix: Update RLS policies for partage_regles to allow UPSERT properly
-- The issue is that upsert needs to UPDATE existing rows,
-- but the previous policies were too restrictive

-- Drop old restrictive policies
drop policy if exists "partage_regles_insert_auth" on public.partage_regles;
drop policy if exists "partage_regles_update_auth" on public.partage_regles;

-- Create new permissive policies for authenticated users
-- These ratios are shared at family level, so any authenticated member can update them
create policy "partage_regles_insert_auth"
  on public.partage_regles
  for insert
  to authenticated
  with check (true);

create policy "partage_regles_update_auth"
  on public.partage_regles
  for update
  to authenticated
  using (true)
  with check (true);

-- Keep select and delete policies as they were (select all, delete own)
-- Note: delete is still restricted to creator to prevent accidental deletions
