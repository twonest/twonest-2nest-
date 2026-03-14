create extension if not exists pgcrypto;

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  family_id text,
  first_name text,
  last_name text,
  birth_date date,
  school_name text,
  school_level text,
  notes text,
  photo_url text,
  doctor_name text,
  doctor_phone text,
  dentist_name text,
  dentist_phone text,
  blood_type text,
  allergies text,
  medications text,
  health_insurance_number text,
  emergency_contacts jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

alter table if exists public.children add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table if exists public.children add column if not exists family_id text;
alter table if exists public.children add column if not exists first_name text;
alter table if exists public.children add column if not exists prenom text;
alter table if exists public.children add column if not exists last_name text;
alter table if exists public.children add column if not exists nom text;
alter table if exists public.children add column if not exists birth_date date;
alter table if exists public.children add column if not exists date_naissance date;
alter table if exists public.children add column if not exists school_name text;
alter table if exists public.children add column if not exists ecole text;
alter table if exists public.children add column if not exists school_level text;
alter table if exists public.children add column if not exists niveau_scolaire text;
alter table if exists public.children add column if not exists notes text;
alter table if exists public.children add column if not exists photo_url text;
alter table if exists public.children add column if not exists doctor_name text;
alter table if exists public.children add column if not exists medecin_nom text;
alter table if exists public.children add column if not exists doctor_phone text;
alter table if exists public.children add column if not exists medecin_telephone text;
alter table if exists public.children add column if not exists dentist_name text;
alter table if exists public.children add column if not exists dentiste_nom text;
alter table if exists public.children add column if not exists dentist_phone text;
alter table if exists public.children add column if not exists dentiste_telephone text;
alter table if exists public.children add column if not exists blood_type text;
alter table if exists public.children add column if not exists groupe_sanguin text;
alter table if exists public.children add column if not exists allergies text;
alter table if exists public.children add column if not exists medications text;
alter table if exists public.children add column if not exists medicaments text;
alter table if exists public.children add column if not exists health_insurance_number text;
alter table if exists public.children add column if not exists numero_assurance_maladie text;
alter table if exists public.children add column if not exists emergency_contacts jsonb;
alter table if exists public.children add column if not exists emergency_contacts_json jsonb;
alter table if exists public.children add column if not exists created_at timestamptz;
alter table if exists public.children add column if not exists updated_at timestamptz;

alter table if exists public.events add column if not exists child_id uuid;
alter table if exists public.events add column if not exists child_name text;
alter table if exists public.events add column if not exists enfant text;

alter table if exists public.expenses add column if not exists child_id uuid;
alter table if exists public.expenses add column if not exists child_name text;
alter table if exists public.expenses add column if not exists enfant text;

alter table if exists public.documents add column if not exists child_id uuid;
alter table if exists public.documents add column if not exists child_name text;
alter table if exists public.documents add column if not exists enfant text;

create index if not exists children_user_id_idx on public.children(user_id);
create index if not exists children_family_id_idx on public.children(family_id);
create index if not exists children_first_name_idx on public.children(first_name);
create index if not exists events_child_id_idx on public.events(child_id);
create index if not exists expenses_child_id_idx on public.expenses(child_id);
create index if not exists documents_child_id_idx on public.documents(child_id);

create or replace function public.set_children_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_set_children_updated_at'
      and tgrelid = 'public.children'::regclass
      and not tgisinternal
  ) then
    create trigger trg_set_children_updated_at
    before update on public.children
    for each row
    execute function public.set_children_updated_at();
  end if;
end;
$$;

alter table public.children enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'children'
      and policyname = 'children_select_own'
  ) then
    alter policy "children_select_own"
    on public.children
    using (auth.uid() = user_id);
  else
    create policy "children_select_own"
    on public.children
    for select
    using (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'children'
      and policyname = 'children_insert_own'
  ) then
    alter policy "children_insert_own"
    on public.children
    with check (auth.uid() = user_id);
  else
    create policy "children_insert_own"
    on public.children
    for insert
    with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'children'
      and policyname = 'children_update_own'
  ) then
    alter policy "children_update_own"
    on public.children
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  else
    create policy "children_update_own"
    on public.children
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'children'
      and policyname = 'children_delete_own'
  ) then
    alter policy "children_delete_own"
    on public.children
    using (auth.uid() = user_id);
  else
    create policy "children_delete_own"
    on public.children
    for delete
    using (auth.uid() = user_id);
  end if;
end;
$$;