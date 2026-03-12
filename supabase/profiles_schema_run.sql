create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  phone text,
  street text,
  city text,
  province text,
  postal_code text,
  country text default 'Canada',
  role text default 'parent1' check (role in ('parent1', 'parent2')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table if exists public.profiles add column if not exists email text;
alter table if exists public.profiles add column if not exists first_name text;
alter table if exists public.profiles add column if not exists last_name text;
alter table if exists public.profiles add column if not exists phone text;
alter table if exists public.profiles add column if not exists street text;
alter table if exists public.profiles add column if not exists city text;
alter table if exists public.profiles add column if not exists province text;
alter table if exists public.profiles add column if not exists postal_code text;
alter table if exists public.profiles add column if not exists country text;
alter table if exists public.profiles add column if not exists role text;
alter table if exists public.profiles add column if not exists avatar_url text;
alter table if exists public.profiles add column if not exists created_at timestamptz;
alter table if exists public.profiles add column if not exists updated_at timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'prenom'
  ) then
    execute 'update public.profiles set first_name = prenom where first_name is null and prenom is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'nom'
  ) then
    execute 'update public.profiles set last_name = nom where last_name is null and nom is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'telephone'
  ) then
    execute 'update public.profiles set phone = telephone where phone is null and telephone is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'address_line1'
  ) then
    execute 'update public.profiles set street = address_line1 where street is null and address_line1 is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'ville'
  ) then
    execute 'update public.profiles set city = ville where city is null and ville is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'code_postal'
  ) then
    execute 'update public.profiles set postal_code = code_postal where postal_code is null and code_postal is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'pays'
  ) then
    execute 'update public.profiles set country = pays where country is null and pays is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'photo_url'
  ) then
    execute 'update public.profiles set avatar_url = photo_url where avatar_url is null and photo_url is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'owner_id'
  ) then
    execute '
      update public.profiles
      set user_id = owner_id::text::uuid
      where user_id is null
        and owner_id is not null
        and owner_id::text ~ ''^[0-9a-fA-F-]{36}$''
    ';
  end if;
end;
$$;

update public.profiles set country = 'Canada' where country is null;
update public.profiles set role = 'parent1' where role is null;
update public.profiles set created_at = now() where created_at is null;
update public.profiles set updated_at = now() where updated_at is null;

alter table public.profiles alter column country set default 'Canada';
alter table public.profiles alter column role set default 'parent1';
alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column updated_at set default now();

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('parent1', 'parent2'));

create unique index if not exists profiles_user_id_uidx on public.profiles(user_id) where user_id is not null;
create index if not exists profiles_role_idx on public.profiles(role);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_profiles_updated_at on public.profiles;
create trigger trg_set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all_authenticated" on public.profiles;
create policy "profiles_select_all_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);
