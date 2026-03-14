create extension if not exists pgcrypto;

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  family_id text,
  first_name text not null,
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
  emergency_contacts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

update public.children
set first_name = coalesce(first_name, prenom)
where first_name is null and prenom is not null;

update public.children
set last_name = coalesce(last_name, nom)
where last_name is null and nom is not null;

update public.children
set birth_date = coalesce(birth_date, date_naissance)
where birth_date is null and date_naissance is not null;

update public.children
set school_name = coalesce(school_name, ecole)
where school_name is null and ecole is not null;

update public.children
set school_level = coalesce(school_level, niveau_scolaire)
where school_level is null and niveau_scolaire is not null;

update public.children
set doctor_name = coalesce(doctor_name, medecin_nom)
where doctor_name is null and medecin_nom is not null;

update public.children
set doctor_phone = coalesce(doctor_phone, medecin_telephone)
where doctor_phone is null and medecin_telephone is not null;

update public.children
set dentist_name = coalesce(dentist_name, dentiste_nom)
where dentist_name is null and dentiste_nom is not null;

update public.children
set dentist_phone = coalesce(dentist_phone, dentiste_telephone)
where dentist_phone is null and dentiste_telephone is not null;

update public.children
set blood_type = coalesce(blood_type, groupe_sanguin)
where blood_type is null and groupe_sanguin is not null;

update public.children
set medications = coalesce(medications, medicaments)
where medications is null and medicaments is not null;

update public.children
set health_insurance_number = coalesce(health_insurance_number, numero_assurance_maladie)
where health_insurance_number is null and numero_assurance_maladie is not null;

update public.children
set emergency_contacts = coalesce(emergency_contacts, emergency_contacts_json, '[]'::jsonb)
where emergency_contacts is null;

update public.children
set created_at = now()
where created_at is null;

update public.children
set updated_at = now()
where updated_at is null;

alter table public.children alter column first_name set not null;
alter table public.children alter column emergency_contacts set default '[]'::jsonb;
alter table public.children alter column created_at set default now();
alter table public.children alter column updated_at set default now();

create index if not exists children_user_id_idx on public.children(user_id);
create index if not exists children_family_id_idx on public.children(family_id);
create index if not exists children_first_name_idx on public.children(first_name);

alter table if exists public.events add column if not exists child_id uuid;
alter table if exists public.expenses add column if not exists child_id uuid;
alter table if exists public.documents add column if not exists child_id uuid;

alter table if exists public.events add column if not exists child_name text;
alter table if exists public.events add column if not exists enfant text;
alter table if exists public.expenses add column if not exists child_name text;
alter table if exists public.expenses add column if not exists enfant text;
alter table if exists public.documents add column if not exists child_name text;
alter table if exists public.documents add column if not exists enfant text;

alter table if exists public.events
  drop constraint if exists events_child_id_fkey;
alter table if exists public.events
  add constraint events_child_id_fkey
  foreign key (child_id) references public.children(id) on delete set null;

alter table if exists public.expenses
  drop constraint if exists expenses_child_id_fkey;
alter table if exists public.expenses
  add constraint expenses_child_id_fkey
  foreign key (child_id) references public.children(id) on delete set null;

alter table if exists public.documents
  drop constraint if exists documents_child_id_fkey;
alter table if exists public.documents
  add constraint documents_child_id_fkey
  foreign key (child_id) references public.children(id) on delete set null;

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

drop trigger if exists trg_set_children_updated_at on public.children;
create trigger trg_set_children_updated_at
before update on public.children
for each row
execute function public.set_children_updated_at();

alter table public.children enable row level security;

drop policy if exists "children_select_own" on public.children;
create policy "children_select_own"
on public.children
for select
using (auth.uid() = user_id);

drop policy if exists "children_insert_own" on public.children;
create policy "children_insert_own"
on public.children
for insert
with check (auth.uid() = user_id);

drop policy if exists "children_update_own" on public.children;
create policy "children_update_own"
on public.children
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "children_delete_own" on public.children;
create policy "children_delete_own"
on public.children
for delete
using (auth.uid() = user_id);
