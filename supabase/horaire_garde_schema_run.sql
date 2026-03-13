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
