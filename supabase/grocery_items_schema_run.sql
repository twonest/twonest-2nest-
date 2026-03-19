-- Schema grocery_items for shared grocery list in 2nest
-- Run this script in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  quantity text,
  category text not null default 'other' check (category in ('fruits_vegetables', 'meats_fish', 'dairy', 'bakery', 'household', 'pharmacy', 'other')),
  added_by uuid references auth.users(id) on delete set null,
  added_by_name text,
  is_checked boolean not null default false,
  is_recurring boolean not null default false,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grocery_items_family_id_idx on public.grocery_items(family_id);
create index if not exists grocery_items_family_category_idx on public.grocery_items(family_id, category);
create index if not exists grocery_items_family_checked_idx on public.grocery_items(family_id, is_checked);
create index if not exists grocery_items_created_at_idx on public.grocery_items(created_at desc);

create or replace function public.set_grocery_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_grocery_items_updated_at on public.grocery_items;
create trigger trg_grocery_items_updated_at
before update on public.grocery_items
for each row
execute function public.set_grocery_items_updated_at();

alter table public.grocery_items enable row level security;

drop policy if exists grocery_items_select_family_member on public.grocery_items;
create policy grocery_items_select_family_member
on public.grocery_items
for select
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = grocery_items.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists grocery_items_insert_family_member on public.grocery_items;
create policy grocery_items_insert_family_member
on public.grocery_items
for insert
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = grocery_items.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists grocery_items_update_family_member on public.grocery_items;
create policy grocery_items_update_family_member
on public.grocery_items
for update
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = grocery_items.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = grocery_items.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists grocery_items_delete_family_member on public.grocery_items;
create policy grocery_items_delete_family_member
on public.grocery_items
for delete
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = grocery_items.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);
