-- Schema collectes for waste/recycling reminders in 2nest
-- Run this script in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.collectes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  garbage_day smallint check (garbage_day between 0 and 6),
  recycling_day smallint check (recycling_day between 0 and 6),
  compost_day smallint check (compost_day between 0 and 6),
  reminder_time time not null default '20:00',
  assignment_mode text not null default 'alternate' check (assignment_mode in ('parent1', 'parent2', 'alternate')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collectes_family_unique unique (family_id)
);

create index if not exists collectes_family_idx on public.collectes(family_id);

create or replace function public.set_collectes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_collectes_updated_at on public.collectes;
create trigger trg_collectes_updated_at
before update on public.collectes
for each row
execute function public.set_collectes_updated_at();

alter table public.collectes enable row level security;

drop policy if exists collectes_select_family_member on public.collectes;
create policy collectes_select_family_member
on public.collectes
for select
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = collectes.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists collectes_insert_family_member on public.collectes;
create policy collectes_insert_family_member
on public.collectes
for insert
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = collectes.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists collectes_update_family_member on public.collectes;
create policy collectes_update_family_member
on public.collectes
for update
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = collectes.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = collectes.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists collectes_delete_family_member on public.collectes;
create policy collectes_delete_family_member
on public.collectes
for delete
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = collectes.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);
