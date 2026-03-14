create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'family' check (type in ('family', 'coparenting', 'solo')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.families add column if not exists name text;
alter table if exists public.families add column if not exists type text;
alter table if exists public.families add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table if exists public.families add column if not exists created_at timestamptz;
alter table if exists public.families add column if not exists updated_at timestamptz;

update public.families set type = 'family' where type is null;
update public.families set created_at = now() where created_at is null;
update public.families set updated_at = now() where updated_at is null;

alter table public.families alter column type set default 'family';
alter table public.families alter column created_at set default now();
alter table public.families alter column updated_at set default now();

alter table public.families drop constraint if exists families_type_check;
alter table public.families add constraint families_type_check check (type in ('family', 'coparenting', 'solo'));

create index if not exists families_created_by_idx on public.families(created_by);

create or replace function public.set_families_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_families_updated_at on public.families;
create trigger trg_set_families_updated_at
before update on public.families
for each row
execute function public.set_families_updated_at();

alter table public.families enable row level security;

drop policy if exists "families_select_member" on public.families;
create policy "families_select_member"
on public.families
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = families.id
      and family_members.user_id = auth.uid()
      and family_members.status = 'active'
  )
);

drop policy if exists "families_insert_creator" on public.families;
create policy "families_insert_creator"
on public.families
for insert
to authenticated
with check (auth.uid() = created_by);

drop policy if exists "families_update_parent" on public.families;
create policy "families_update_parent"
on public.families
for update
to authenticated
using (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = families.id
      and family_members.user_id = auth.uid()
      and family_members.role = 'parent'
      and family_members.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = families.id
      and family_members.user_id = auth.uid()
      and family_members.role = 'parent'
      and family_members.status = 'active'
  )
);

drop policy if exists "families_delete_parent" on public.families;
create policy "families_delete_parent"
on public.families
for delete
to authenticated
using (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = families.id
      and family_members.user_id = auth.uid()
      and family_members.role = 'parent'
      and family_members.status = 'active'
  )
);