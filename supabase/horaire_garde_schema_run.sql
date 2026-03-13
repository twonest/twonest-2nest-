create extension if not exists pgcrypto;

create table if not exists public.horaire_garde (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_type text not null check (schedule_type in ('weekly_alternating', 'biweekly_alternating', 'custom_shared')),
  custom_schedule jsonb,
  exchange_time time not null,
  exchange_location text not null,
  legal_contact_name text not null,
  case_number text,
  agreement_date date not null,
  mediator_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.horaire_garde add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table if exists public.horaire_garde add column if not exists schedule_type text;
alter table if exists public.horaire_garde add column if not exists custom_schedule jsonb;
alter table if exists public.horaire_garde add column if not exists exchange_time time;
alter table if exists public.horaire_garde add column if not exists exchange_location text;
alter table if exists public.horaire_garde add column if not exists legal_contact_name text;
alter table if exists public.horaire_garde add column if not exists case_number text;
alter table if exists public.horaire_garde add column if not exists agreement_date date;
alter table if exists public.horaire_garde add column if not exists mediator_notes text;
alter table if exists public.horaire_garde add column if not exists created_at timestamptz;
alter table if exists public.horaire_garde add column if not exists updated_at timestamptz;

update public.horaire_garde
set
  schedule_type = coalesce(schedule_type, 'weekly_alternating'),
  exchange_time = coalesce(exchange_time, '17:00'::time),
  exchange_location = coalesce(exchange_location, 'École'),
  legal_contact_name = coalesce(legal_contact_name, 'Non renseigné'),
  agreement_date = coalesce(agreement_date, current_date),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where
  schedule_type is null
  or exchange_time is null
  or exchange_location is null
  or legal_contact_name is null
  or agreement_date is null
  or created_at is null
  or updated_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'horaire_garde_schedule_type_check'
      and conrelid = 'public.horaire_garde'::regclass
  ) then
    alter table public.horaire_garde
      add constraint horaire_garde_schedule_type_check
      check (schedule_type in ('weekly_alternating', 'biweekly_alternating', 'custom_shared'));
  end if;
end
$$;

create unique index if not exists horaire_garde_user_uidx on public.horaire_garde(user_id);

grant select, insert, update, delete on table public.horaire_garde to authenticated;

alter table public.horaire_garde enable row level security;

drop policy if exists "horaire_garde_select_authenticated" on public.horaire_garde;
create policy "horaire_garde_select_authenticated"
on public.horaire_garde
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "horaire_garde_insert_authenticated" on public.horaire_garde;
create policy "horaire_garde_insert_authenticated"
on public.horaire_garde
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "horaire_garde_update_authenticated" on public.horaire_garde;
create policy "horaire_garde_update_authenticated"
on public.horaire_garde
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "horaire_garde_delete_authenticated" on public.horaire_garde;
create policy "horaire_garde_delete_authenticated"
on public.horaire_garde
for delete
to authenticated
using (auth.uid() = user_id);
