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
  cycle_length_days integer null,
  is_override boolean not null default false,
  base_shift_id uuid null references public.work_shifts(id) on delete set null,
  reason text null,
  notify_coparent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_shifts_end_after_start check (end_at > start_at)
);

alter table if exists public.work_shifts
add column if not exists family_id uuid references public.families(id) on delete cascade;

alter table if exists public.work_shifts
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table if exists public.work_shifts
add column if not exists title text;

alter table if exists public.work_shifts
add column if not exists shift_type text;

alter table if exists public.work_shifts
add column if not exists start_at timestamptz;

alter table if exists public.work_shifts
add column if not exists end_at timestamptz;

alter table if exists public.work_shifts
add column if not exists location text;

alter table if exists public.work_shifts
add column if not exists color text;

alter table if exists public.work_shifts
add column if not exists recurrence_mode text;

alter table if exists public.work_shifts
add column if not exists recurrence_days smallint[];

alter table if exists public.work_shifts
add column if not exists recurrence_start date;

alter table if exists public.work_shifts
add column if not exists recurrence_end date;

alter table if exists public.work_shifts
add column if not exists frequency text;

alter table if exists public.work_shifts
add column if not exists cycle_length_days integer;

alter table if exists public.work_shifts
add column if not exists is_override boolean;

alter table if exists public.work_shifts
add column if not exists base_shift_id uuid references public.work_shifts(id) on delete set null;

alter table if exists public.work_shifts
add column if not exists reason text;

alter table if exists public.work_shifts
add column if not exists notify_coparent boolean;

alter table if exists public.work_shifts
add column if not exists created_at timestamptz;

alter table if exists public.work_shifts
add column if not exists updated_at timestamptz;

update public.work_shifts
set title = coalesce(nullif(title, ''), 'Shift travail')
where title is null or title = '';

update public.work_shifts
set shift_type = 'jour'
where shift_type is null;

update public.work_shifts
set color = '#2C3E50'
where color is null;

update public.work_shifts
set recurrence_mode = 'once'
where recurrence_mode is null;

update public.work_shifts
set is_override = false
where is_override is null;

update public.work_shifts
set notify_coparent = false
where notify_coparent is null;

update public.work_shifts
set created_at = now()
where created_at is null;

update public.work_shifts
set updated_at = now()
where updated_at is null;

alter table public.work_shifts
alter column title set not null;

alter table public.work_shifts
alter column shift_type set not null;

alter table public.work_shifts
alter column color set not null;

alter table public.work_shifts
alter column recurrence_mode set not null;

alter table public.work_shifts
alter column is_override set not null;

alter table public.work_shifts
alter column notify_coparent set not null;

alter table public.work_shifts
alter column created_at set not null;

alter table public.work_shifts
alter column updated_at set not null;

alter table public.work_shifts
alter column shift_type set default 'jour';

alter table public.work_shifts
alter column color set default '#2C3E50';

alter table public.work_shifts
alter column recurrence_mode set default 'once';

alter table public.work_shifts
alter column is_override set default false;

alter table public.work_shifts
alter column notify_coparent set default false;

alter table public.work_shifts
alter column created_at set default now();

alter table public.work_shifts
alter column updated_at set default now();

alter table public.work_shifts
drop constraint if exists work_shifts_shift_type_check;

alter table public.work_shifts
add constraint work_shifts_shift_type_check check (shift_type in ('jour', 'soir', 'nuit', 'personnalise'));

alter table public.work_shifts
drop constraint if exists work_shifts_recurrence_mode_check;

alter table public.work_shifts
add constraint work_shifts_recurrence_mode_check check (recurrence_mode in ('once', 'recurring'));

alter table public.work_shifts
drop constraint if exists work_shifts_frequency_check;

alter table public.work_shifts
add constraint work_shifts_frequency_check check (frequency in ('weekly', 'biweekly', 'custom') or frequency is null);

alter table public.work_shifts
drop constraint if exists work_shifts_cycle_length_days_check;

alter table public.work_shifts
add constraint work_shifts_cycle_length_days_check check (cycle_length_days is null or cycle_length_days > 0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'work_shifts_end_after_start'
      and conrelid = 'public.work_shifts'::regclass
  ) then
    execute 'alter table public.work_shifts add constraint work_shifts_end_after_start check (end_at > start_at)';
  end if;
end;
$$;

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
