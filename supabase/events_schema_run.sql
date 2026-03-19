create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  type text not null check (type in ('Garde', 'Médecin', 'École', 'Activité', 'Épicerie', 'Poubelles/Recyclage', 'Planification des repas', 'Entretien maison', 'Formulaire à signer')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  parent text not null default 'parent1' check (parent in ('parent1', 'parent2')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (end_at > start_at)
);

alter table if exists public.events
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table if exists public.events
add column if not exists family_id uuid references public.families(id) on delete cascade;

alter table if exists public.events
add column if not exists title text;

alter table if exists public.events
add column if not exists type text;

alter table if exists public.events
add column if not exists start_at timestamptz;

alter table if exists public.events
add column if not exists end_at timestamptz;

alter table if exists public.events
add column if not exists parent text;

alter table if exists public.events
add column if not exists created_at timestamptz;

alter table if exists public.events
add column if not exists updated_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'owner_id'
  ) then
    execute '
      update public.events
      set user_id = owner_id::text::uuid
      where user_id is null
        and owner_id is not null
        and owner_id::text ~ ''^[0-9a-fA-F-]{36}$''
    ';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'start_date'
  ) then
    execute '
      update public.events
      set start_at = start_date::timestamptz
      where start_at is null and start_date is not null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'end_date'
  ) then
    execute '
      update public.events
      set end_at = end_date::timestamptz
      where end_at is null and end_date is not null
    ';
  end if;
end;
$$;

update public.events
set parent = 'parent1'
where parent is null;

update public.events
set created_at = now()
where created_at is null;

update public.events
set updated_at = now()
where updated_at is null;

update public.events
set type = 'Activité'
where type is null;

alter table public.events
alter column parent set default 'parent1';

alter table public.events
alter column created_at set default now();

alter table public.events
alter column updated_at set default now();

alter table public.events
drop constraint if exists events_type_check;

alter table public.events
add constraint events_type_check check (type in ('Garde', 'Médecin', 'École', 'Activité', 'Épicerie', 'Poubelles/Recyclage', 'Planification des repas', 'Entretien maison', 'Formulaire à signer'));

alter table public.events
drop constraint if exists events_parent_check;

alter table public.events
add constraint events_parent_check check (parent in ('parent1', 'parent2'));

alter table public.events
drop constraint if exists events_end_after_start;

alter table public.events
add constraint events_end_after_start check (end_at > start_at);

do $$
begin
  if not exists (
    select 1
    from public.events
    where user_id is null
  ) then
    alter table public.events
    alter column user_id set not null;
  end if;
end;
$$;

create index if not exists events_user_id_idx on public.events(user_id);
create index if not exists events_family_id_idx on public.events(family_id);
create index if not exists events_start_at_idx on public.events(start_at);

create or replace function public.set_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_events_updated_at on public.events;
create trigger trg_set_events_updated_at
before update on public.events
for each row
execute function public.set_events_updated_at();

alter table public.events enable row level security;

drop policy if exists "events_select_own" on public.events;
create policy "events_select_own"
on public.events
for select
using (auth.uid() = user_id);

drop policy if exists "events_select_family_member" on public.events;
create policy "events_select_family_member"
on public.events
for select
using (
  family_id is not null
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = events.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own"
on public.events
for insert
with check (auth.uid() = user_id);

drop policy if exists "events_insert_family_member" on public.events;
create policy "events_insert_family_member"
on public.events
for insert
with check (
  family_id is not null
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = events.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists "events_update_own" on public.events;
create policy "events_update_own"
on public.events
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "events_update_family_member" on public.events;
create policy "events_update_family_member"
on public.events
for update
using (
  family_id is not null
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = events.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
)
with check (
  family_id is not null
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = events.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists "events_delete_own" on public.events;
create policy "events_delete_own"
on public.events
for delete
using (auth.uid() = user_id);

drop policy if exists "events_delete_family_member" on public.events;
create policy "events_delete_family_member"
on public.events
for delete
using (
  family_id is not null
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = events.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);