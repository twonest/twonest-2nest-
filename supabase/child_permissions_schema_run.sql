create extension if not exists pgcrypto;

create table if not exists public.child_permissions (
  id uuid default gen_random_uuid() primary key,
  child_id uuid,
  user_id uuid,
  accorde_par uuid,
  permissions jsonb default '{}',
  created_at timestamp default now()
);

alter table if exists public.child_permissions add column if not exists child_id uuid;
alter table if exists public.child_permissions add column if not exists user_id uuid;
alter table if exists public.child_permissions add column if not exists accorde_par uuid;
alter table if exists public.child_permissions add column if not exists permissions jsonb default '{}';
alter table if exists public.child_permissions add column if not exists created_at timestamp default now();

create unique index if not exists child_permissions_child_user_uidx on public.child_permissions(child_id, user_id);
create index if not exists child_permissions_user_id_idx on public.child_permissions(user_id);
create index if not exists child_permissions_child_id_idx on public.child_permissions(child_id);

alter table child_permissions 
disable row level security;