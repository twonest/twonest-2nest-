create extension if not exists pgcrypto;

create table if not exists public.journal_garde (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  garde_date date not null,
  parent_role text not null default 'parent1' check (parent_role in ('parent1','parent2')),
  title text,
  created_at timestamptz not null default now(),
  constraint journal_garde_event_day_unique unique (event_id, garde_date)
);

alter table if exists public.journal_garde add column if not exists event_id text;
alter table if exists public.journal_garde add column if not exists garde_date date;
alter table if exists public.journal_garde add column if not exists parent_role text;
alter table if exists public.journal_garde add column if not exists title text;
alter table if exists public.journal_garde add column if not exists created_at timestamptz;

create index if not exists journal_garde_date_idx on public.journal_garde(garde_date);
create index if not exists journal_garde_parent_role_idx on public.journal_garde(parent_role);

alter table public.journal_garde enable row level security;

drop policy if exists "journal_garde_select_authenticated" on public.journal_garde;
create policy "journal_garde_select_authenticated"
on public.journal_garde
for select
to authenticated
using (true);

drop policy if exists "journal_garde_insert_authenticated" on public.journal_garde;
create policy "journal_garde_insert_authenticated"
on public.journal_garde
for insert
to authenticated
with check (true);

drop policy if exists "journal_garde_update_authenticated" on public.journal_garde;
create policy "journal_garde_update_authenticated"
on public.journal_garde
for update
to authenticated
using (true)
with check (true);

drop policy if exists "journal_garde_delete_authenticated" on public.journal_garde;
create policy "journal_garde_delete_authenticated"
on public.journal_garde
for delete
to authenticated
using (true);
