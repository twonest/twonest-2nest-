create extension if not exists pgcrypto;

create table if not exists public.jours_speciaux (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  date date not null,
  type text not null default 'ferie' check (type in ('ferie','pedagogique','vacances','scolaire')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.jours_speciaux add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table if exists public.jours_speciaux add column if not exists title text;
alter table if exists public.jours_speciaux add column if not exists date date;
alter table if exists public.jours_speciaux add column if not exists type text;
alter table if exists public.jours_speciaux add column if not exists notes text;
alter table if exists public.jours_speciaux add column if not exists created_at timestamptz;
alter table if exists public.jours_speciaux add column if not exists updated_at timestamptz;

create index if not exists jours_speciaux_date_idx on public.jours_speciaux(date);
create index if not exists jours_speciaux_type_idx on public.jours_speciaux(type);

create or replace function public.set_jours_speciaux_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_jours_speciaux_updated_at on public.jours_speciaux;
create trigger trg_set_jours_speciaux_updated_at
before update on public.jours_speciaux
for each row
execute function public.set_jours_speciaux_updated_at();

alter table public.jours_speciaux enable row level security;

drop policy if exists "jours_speciaux_select_authenticated" on public.jours_speciaux;
create policy "jours_speciaux_select_authenticated"
on public.jours_speciaux
for select
to authenticated
using (true);

drop policy if exists "jours_speciaux_insert_authenticated" on public.jours_speciaux;
create policy "jours_speciaux_insert_authenticated"
on public.jours_speciaux
for insert
to authenticated
with check (true);

drop policy if exists "jours_speciaux_update_authenticated" on public.jours_speciaux;
create policy "jours_speciaux_update_authenticated"
on public.jours_speciaux
for update
to authenticated
using (true)
with check (true);

drop policy if exists "jours_speciaux_delete_authenticated" on public.jours_speciaux;
create policy "jours_speciaux_delete_authenticated"
on public.jours_speciaux
for delete
to authenticated
using (true);

insert into public.jours_speciaux (title, date, type, notes)
values
  ('Jour de l''An', make_date(extract(year from now())::int, 1, 1), 'ferie', null),
  ('Fête nationale du Québec', make_date(extract(year from now())::int, 6, 24), 'ferie', null),
  ('Fête du Canada', make_date(extract(year from now())::int, 7, 1), 'ferie', null),
  ('Noël', make_date(extract(year from now())::int, 12, 25), 'ferie', null)
on conflict do nothing;
