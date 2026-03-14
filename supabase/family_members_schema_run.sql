create extension if not exists pgcrypto;

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invite_email text,
  role text not null default 'parent' check (role in ('parent', 'step_parent', 'grand_parent', 'mediator')),
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'pending')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.family_members add column if not exists family_id uuid references public.families(id) on delete cascade;
alter table if exists public.family_members add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table if exists public.family_members add column if not exists invite_email text;
alter table if exists public.family_members add column if not exists role text;
alter table if exists public.family_members add column if not exists permissions jsonb;
alter table if exists public.family_members add column if not exists status text;
alter table if exists public.family_members add column if not exists invited_by uuid references auth.users(id) on delete set null;
alter table if exists public.family_members add column if not exists created_at timestamptz;
alter table if exists public.family_members add column if not exists updated_at timestamptz;

update public.family_members set permissions = '{}'::jsonb where permissions is null;
update public.family_members set status = 'active' where status is null;
update public.family_members set created_at = now() where created_at is null;
update public.family_members set updated_at = now() where updated_at is null;

alter table public.family_members alter column permissions set default '{}'::jsonb;
alter table public.family_members alter column status set default 'active';
alter table public.family_members alter column created_at set default now();
alter table public.family_members alter column updated_at set default now();

alter table public.family_members drop constraint if exists family_members_role_check;
alter table public.family_members add constraint family_members_role_check check (role in ('parent', 'step_parent', 'grand_parent', 'mediator'));
alter table public.family_members drop constraint if exists family_members_status_check;
alter table public.family_members add constraint family_members_status_check check (status in ('active', 'pending'));

create unique index if not exists family_members_family_user_uidx on public.family_members(family_id, user_id) where user_id is not null;
create unique index if not exists family_members_family_invite_email_uidx on public.family_members(family_id, lower(invite_email)) where invite_email is not null;
create index if not exists family_members_user_id_idx on public.family_members(user_id);
create index if not exists family_members_family_id_idx on public.family_members(family_id);

create or replace function public.set_family_members_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_family_members_updated_at on public.family_members;
create trigger trg_set_family_members_updated_at
before update on public.family_members
for each row
execute function public.set_family_members_updated_at();

alter table public.family_members enable row level security;

drop policy if exists "family_members_select_family_member" on public.family_members;
create policy "family_members_select_family_member"
on public.family_members
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members as current_member
    where current_member.family_id = family_members.family_id
      and current_member.user_id = auth.uid()
      and current_member.status = 'active'
  )
);

drop policy if exists "family_members_insert_parent_or_self" on public.family_members;
create policy "family_members_insert_parent_or_self"
on public.family_members
for insert
to authenticated
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.family_members as current_member
    where current_member.family_id = family_members.family_id
      and current_member.user_id = auth.uid()
      and current_member.role = 'parent'
      and current_member.status = 'active'
  )
  or exists (
    select 1
    from public.families
    where families.id = family_members.family_id
      and families.created_by = auth.uid()
  )
);

drop policy if exists "family_members_update_parent" on public.family_members;
create policy "family_members_update_parent"
on public.family_members
for update
to authenticated
using (
  exists (
    select 1
    from public.family_members as current_member
    where current_member.family_id = family_members.family_id
      and current_member.user_id = auth.uid()
      and current_member.role = 'parent'
      and current_member.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.family_members as current_member
    where current_member.family_id = family_members.family_id
      and current_member.user_id = auth.uid()
      and current_member.role = 'parent'
      and current_member.status = 'active'
  )
);

drop policy if exists "family_members_delete_parent_or_self" on public.family_members;
create policy "family_members_delete_parent_or_self"
on public.family_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.family_members as current_member
    where current_member.family_id = family_members.family_id
      and current_member.user_id = auth.uid()
      and current_member.role = 'parent'
      and current_member.status = 'active'
  )
);