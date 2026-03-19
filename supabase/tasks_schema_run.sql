-- Schema tasks + rewards for 2nest
-- Run this in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'general',
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  due_date timestamptz,
  assigned_kind text not null default 'member' check (assigned_kind in ('member', 'child')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  assigned_child_id uuid references public.children(id) on delete set null,
  linked_child_id uuid references public.children(id) on delete set null,
  points integer default 0 check (points >= 0 and points <= 10),
  is_recurring boolean not null default false,
  recurrence_frequency text check (recurrence_frequency in ('daily', 'weekly', 'monthly')),
  recurrence_weekday smallint check (recurrence_weekday between 0 and 6),
  recurrence_monthday smallint check (recurrence_monthday between 1 and 31),
  proof_url text,
  proof_path text,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_family_id_idx on public.tasks(family_id);
create index if not exists tasks_due_date_idx on public.tasks(family_id, due_date);
create index if not exists tasks_status_idx on public.tasks(family_id, status);
create index if not exists tasks_assigned_child_idx on public.tasks(assigned_child_id);

create table if not exists public.task_rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  label text not null,
  points_required integer not null check (points_required > 0),
  created_at timestamptz not null default now()
);

create index if not exists task_rewards_family_id_idx on public.task_rewards(family_id);

create or replace function public.set_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tasks_set_updated_at on public.tasks;
create trigger trg_tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_tasks_updated_at();

alter table public.tasks enable row level security;
alter table public.task_rewards enable row level security;

-- Members of a family can read and write tasks in their own family space.
drop policy if exists tasks_select_family_member on public.tasks;
create policy tasks_select_family_member
on public.tasks
for select
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = tasks.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists tasks_insert_family_member on public.tasks;
create policy tasks_insert_family_member
on public.tasks
for insert
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = tasks.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists tasks_update_family_member on public.tasks;
create policy tasks_update_family_member
on public.tasks
for update
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = tasks.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = tasks.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists tasks_delete_family_member on public.tasks;
create policy tasks_delete_family_member
on public.tasks
for delete
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = tasks.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists task_rewards_select_family_member on public.task_rewards;
create policy task_rewards_select_family_member
on public.task_rewards
for select
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = task_rewards.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists task_rewards_insert_family_member on public.task_rewards;
create policy task_rewards_insert_family_member
on public.task_rewards
for insert
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = task_rewards.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists task_rewards_update_family_member on public.task_rewards;
create policy task_rewards_update_family_member
on public.task_rewards
for update
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = task_rewards.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = task_rewards.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists task_rewards_delete_family_member on public.task_rewards;
create policy task_rewards_delete_family_member
on public.task_rewards
for delete
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = task_rewards.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

insert into storage.buckets (id, name, public)
values ('tasks', 'tasks', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload and read task proofs.
drop policy if exists tasks_bucket_public_read on storage.objects;
create policy tasks_bucket_public_read
on storage.objects
for select
to authenticated
using (bucket_id = 'tasks');

drop policy if exists tasks_bucket_insert_authenticated on storage.objects;
create policy tasks_bucket_insert_authenticated
on storage.objects
for insert
to authenticated
with check (bucket_id = 'tasks');

drop policy if exists tasks_bucket_update_authenticated on storage.objects;
create policy tasks_bucket_update_authenticated
on storage.objects
for update
to authenticated
using (bucket_id = 'tasks')
with check (bucket_id = 'tasks');

drop policy if exists tasks_bucket_delete_authenticated on storage.objects;
create policy tasks_bucket_delete_authenticated
on storage.objects
for delete
to authenticated
using (bucket_id = 'tasks');
