-- Table des règles de partage par catégorie (Parent 1 / Parent 2)
create table if not exists public.partage_regles (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  parent1_pct numeric(5,2) not null check (parent1_pct >= 0 and parent1_pct <= 100),
  parent2_pct numeric(5,2) not null check (parent2_pct >= 0 and parent2_pct <= 100),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partage_regles_category_unique unique (category)
);

create index if not exists partage_regles_category_idx on public.partage_regles(category);

create or replace function public.set_partage_regles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_partage_regles_updated_at on public.partage_regles;
create trigger trg_partage_regles_updated_at
before update on public.partage_regles
for each row
execute procedure public.set_partage_regles_updated_at();

alter table public.partage_regles enable row level security;

drop policy if exists "partage_regles_select_auth" on public.partage_regles;
create policy "partage_regles_select_auth"
  on public.partage_regles
  for select
  to authenticated
  using (true);

drop policy if exists "partage_regles_insert_auth" on public.partage_regles;
create policy "partage_regles_insert_auth"
  on public.partage_regles
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "partage_regles_update_auth" on public.partage_regles;
create policy "partage_regles_update_auth"
  on public.partage_regles
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "partage_regles_delete_auth" on public.partage_regles;
create policy "partage_regles_delete_auth"
  on public.partage_regles
  for delete
  to authenticated
  using (created_by = auth.uid());

-- Valeurs par défaut correspondant au frontend
insert into public.partage_regles (category, parent1_pct, parent2_pct)
values
  ('Médical', 50, 50),
  ('Scolaire', 50, 50),
  ('Activités', 50, 50),
  ('Vêtements', 50, 50),
  ('Nourriture', 50, 50),
  ('Autre', 50, 50)
on conflict (category) do nothing;
