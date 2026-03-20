-- Schema work_shifts for parent work schedules in 2nest
-- Run this script in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  shift_type text not null default 'jour' check (shift_type in ('jour', 'soir', 'nuit', 'personnalise')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  location text,
  color text not null default '#2C3E50',
  recurrence_mode text not null default 'once' check (recurrence_mode in ('once', 'recurring')),
  recurrence_days smallint[] null,
  recurrence_start date null,
  recurrence_end date null,
  frequency text null check (frequency in ('weekly', 'biweekly', 'custom')),
  is_override boolean not null default false,
  base_shift_id uuid null references public.work_shifts(id) on delete set null,
  reason text null,
  notify_coparent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_shifts_end_after_start check (end_at > start_at)
);

create index if not exists work_shifts_family_idx on public.work_shifts(family_id);
create index if not exists work_shifts_user_idx on public.work_shifts(user_id);
create index if not exists work_shifts_start_idx on public.work_shifts(start_at);

create or replace function public.set_work_shifts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_work_shifts_updated_at on public.work_shifts;
create trigger trg_work_shifts_updated_at
before update on public.work_shifts
for each row
execute function public.set_work_shifts_updated_at();

alter table public.work_shifts enable row level security;

drop policy if exists work_shifts_select_family_member on public.work_shifts;
create policy work_shifts_select_family_member
on public.work_shifts
for select
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = work_shifts.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists work_shifts_insert_family_member on public.work_shifts;
create policy work_shifts_insert_family_member
on public.work_shifts
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = work_shifts.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists work_shifts_update_family_member on public.work_shifts;
create policy work_shifts_update_family_member
on public.work_shifts
for update
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = work_shifts.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = work_shifts.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists work_shifts_delete_family_member on public.work_shifts;
create policy work_shifts_delete_family_member
on public.work_shifts
for delete
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = work_shifts.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);
