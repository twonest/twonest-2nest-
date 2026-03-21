-- Table meal_plans
create table if not exists meal_plans (
  id uuid default gen_random_uuid() primary key,
  family_id uuid,
  semaine_debut date,
  jour text,
  type_repas text,
  nom_repas text,
  nb_personnes integer default 4,
  ingredients jsonb,
  notes text,
  created_by uuid,
  created_at timestamp default now()
);

-- Table recipes
create table if not exists recipes (
  id uuid default gen_random_uuid() primary key,
  family_id uuid,
  nom text,
  description text,
  ingredients jsonb,
  temps_prep integer,
  nb_personnes integer default 4,
  photo_url text,
  notes_allergies text,
  created_by uuid,
  created_at timestamp default now()
);

alter table meal_plans disable row level security;
alter table recipes disable row level security;
