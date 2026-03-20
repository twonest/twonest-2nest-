-- Migrate public.collectes to per-type rows with simple A/B cycle support
-- Run this script in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.collectes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade
);

alter table if exists public.collectes
add column if not exists family_id uuid references public.families(id) on delete cascade;

alter table if exists public.collectes
add column if not exists type text;

alter table if exists public.collectes
add column if not exists jour_semaine smallint;

alter table if exists public.collectes
add column if not exists frequence text;

alter table if exists public.collectes
add column if not exists semaines_alternees text;

alter table if exists public.collectes
add column if not exists assignment_mode text;

alter table if exists public.collectes
add column if not exists heure_rappel time;

alter table if exists public.collectes
add column if not exists nom text;

alter table if exists public.collectes
add column if not exists couleur text;

alter table if exists public.collectes
add column if not exists icone text;

alter table if exists public.collectes
add column if not exists date_debut date;

alter table if exists public.collectes
add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table if exists public.collectes
add column if not exists created_at timestamptz;

alter table if exists public.collectes
add column if not exists updated_at timestamptz;

create or replace function pg_temp.normalize_collecte_weekday(value text)
returns smallint
language sql
immutable
as $$
  select case
    when value is null then null
    when btrim(lower(value)) = '' then null
    when btrim(lower(value)) ~ '^[0-6]$' then btrim(value)::smallint
    when btrim(lower(value)) in ('dimanche', 'sunday') then 0
    when btrim(lower(value)) in ('lundi', 'monday') then 1
    when btrim(lower(value)) in ('mardi', 'tuesday') then 2
    when btrim(lower(value)) in ('mercredi', 'wednesday') then 3
    when btrim(lower(value)) in ('jeudi', 'thursday') then 4
    when btrim(lower(value)) in ('vendredi', 'friday') then 5
    when btrim(lower(value)) in ('samedi', 'saturday') then 6
    else null
  end;
$$;

do $$
declare
  jour_semaine_type text;
begin
  select c.data_type
  into jour_semaine_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'collectes'
    and c.column_name = 'jour_semaine';

  if jour_semaine_type is not null
     and jour_semaine_type not in ('smallint', 'integer', 'bigint') then
    execute '
      alter table public.collectes
      alter column jour_semaine type smallint
      using pg_temp.normalize_collecte_weekday(jour_semaine::text)
    ';
  end if;
end;
$$;

update public.collectes
set frequence = 'weekly'
where frequence is null;

update public.collectes
set assignment_mode = 'alternate'
where assignment_mode is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'collectes'
      and column_name = 'reminder_time'
  ) then
    execute '
      update public.collectes
      set heure_rappel = coalesce(heure_rappel, reminder_time, ''20:00''::time)
      where heure_rappel is null
    ';
  else
    update public.collectes
    set heure_rappel = '20:00'::time
    where heure_rappel is null;
  end if;
end;
$$;

update public.collectes
set date_debut = current_date
where date_debut is null;

update public.collectes
set created_at = now()
where created_at is null;

update public.collectes
set updated_at = now()
where updated_at is null;

update public.collectes
set jour_semaine = pg_temp.normalize_collecte_weekday(jour_semaine::text)
where jour_semaine is distinct from pg_temp.normalize_collecte_weekday(jour_semaine::text);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'collectes'
      and column_name = 'garbage_day'
  ) then
    execute '
      update public.collectes
      set type = ''ordures'',
          jour_semaine = coalesce(jour_semaine, pg_temp.normalize_collecte_weekday(garbage_day::text)),
          nom = coalesce(nullif(nom, ''''), ''Collecte ordures''),
          couleur = coalesce(nullif(couleur, ''''), ''#7F8C8D''),
          icone = coalesce(nullif(icone, ''''), ''Trash2'')
      where type is null
    ';
  else
    update public.collectes
    set type = 'ordures',
        nom = coalesce(nullif(nom, ''), 'Collecte ordures'),
        couleur = coalesce(nullif(couleur, ''), '#7F8C8D'),
        icone = coalesce(nullif(icone, ''), 'Trash2')
    where type is null;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'collectes'
      and column_name = 'recycling_day'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'collectes'
        and column_name = 'reminder_time'
    ) then
      execute '
        insert into public.collectes (
          family_id,
          type,
          jour_semaine,
          frequence,
          semaines_alternees,
          assignment_mode,
          heure_rappel,
          nom,
          couleur,
          icone,
          date_debut,
          created_by,
          created_at,
          updated_at
        )
        select
          family_id,
          ''recyclage'',
          pg_temp.normalize_collecte_weekday(recycling_day::text),
          coalesce(frequence, ''weekly''),
          semaines_alternees,
          coalesce(assignment_mode, ''alternate''),
          coalesce(heure_rappel, reminder_time, ''20:00''::time),
          ''Collecte recyclage'',
          ''#27AE60'',
          ''RefreshCw'',
          coalesce(date_debut, current_date),
          created_by,
          coalesce(created_at, now()),
          coalesce(updated_at, now())
        from public.collectes source
        where pg_temp.normalize_collecte_weekday(recycling_day::text) is not null
          and not exists (
            select 1
            from public.collectes target
            where target.family_id = source.family_id
              and target.type = ''recyclage''
          )
      ';
    else
      execute '
        insert into public.collectes (
          family_id,
          type,
          jour_semaine,
          frequence,
          semaines_alternees,
          assignment_mode,
          heure_rappel,
          nom,
          couleur,
          icone,
          date_debut,
          created_by,
          created_at,
          updated_at
        )
        select
          family_id,
          ''recyclage'',
          pg_temp.normalize_collecte_weekday(recycling_day::text),
          coalesce(frequence, ''weekly''),
          semaines_alternees,
          coalesce(assignment_mode, ''alternate''),
          coalesce(heure_rappel, ''20:00''::time),
          ''Collecte recyclage'',
          ''#27AE60'',
          ''RefreshCw'',
          coalesce(date_debut, current_date),
          created_by,
          coalesce(created_at, now()),
          coalesce(updated_at, now())
        from public.collectes source
        where pg_temp.normalize_collecte_weekday(recycling_day::text) is not null
          and not exists (
            select 1
            from public.collectes target
            where target.family_id = source.family_id
              and target.type = ''recyclage''
          )
      ';
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'collectes'
      and column_name = 'compost_day'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'collectes'
        and column_name = 'reminder_time'
    ) then
      execute '
        insert into public.collectes (
          family_id,
          type,
          jour_semaine,
          frequence,
          semaines_alternees,
          assignment_mode,
          heure_rappel,
          nom,
          couleur,
          icone,
          date_debut,
          created_by,
          created_at,
          updated_at
        )
        select
          family_id,
          ''compost'',
          pg_temp.normalize_collecte_weekday(compost_day::text),
          coalesce(frequence, ''weekly''),
          semaines_alternees,
          coalesce(assignment_mode, ''alternate''),
          coalesce(heure_rappel, reminder_time, ''20:00''::time),
          ''Collecte compost'',
          ''#8B6914'',
          ''Leaf'',
          coalesce(date_debut, current_date),
          created_by,
          coalesce(created_at, now()),
          coalesce(updated_at, now())
        from public.collectes source
        where pg_temp.normalize_collecte_weekday(compost_day::text) is not null
          and not exists (
            select 1
            from public.collectes target
            where target.family_id = source.family_id
              and target.type = ''compost''
          )
      ';
    else
      execute '
        insert into public.collectes (
          family_id,
          type,
          jour_semaine,
          frequence,
          semaines_alternees,
          assignment_mode,
          heure_rappel,
          nom,
          couleur,
          icone,
          date_debut,
          created_by,
          created_at,
          updated_at
        )
        select
          family_id,
          ''compost'',
          pg_temp.normalize_collecte_weekday(compost_day::text),
          coalesce(frequence, ''weekly''),
          semaines_alternees,
          coalesce(assignment_mode, ''alternate''),
          coalesce(heure_rappel, ''20:00''::time),
          ''Collecte compost'',
          ''#8B6914'',
          ''Leaf'',
          coalesce(date_debut, current_date),
          created_by,
          coalesce(created_at, now()),
          coalesce(updated_at, now())
        from public.collectes source
        where pg_temp.normalize_collecte_weekday(compost_day::text) is not null
          and not exists (
            select 1
            from public.collectes target
            where target.family_id = source.family_id
              and target.type = ''compost''
          )
      ';
    end if;
  end if;
end;
$$;

alter table public.collectes
alter column type set not null;

alter table public.collectes
alter column frequence set default 'weekly';

alter table public.collectes
alter column assignment_mode set default 'alternate';

alter table public.collectes
alter column heure_rappel set default '20:00';

alter table public.collectes
alter column created_at set default now();

alter table public.collectes
alter column updated_at set default now();

alter table public.collectes
drop constraint if exists collectes_family_unique;

alter table public.collectes
drop constraint if exists collectes_type_check;

alter table public.collectes
add constraint collectes_type_check
check (type in ('ordures', 'recyclage', 'compost'));

alter table public.collectes
drop constraint if exists collectes_jour_semaine_check;

alter table public.collectes
add constraint collectes_jour_semaine_check
check (jour_semaine between 0 and 6);

alter table public.collectes
drop constraint if exists collectes_assignment_mode_check;

alter table public.collectes
add constraint collectes_assignment_mode_check
check (assignment_mode in ('parent1', 'parent2', 'alternate'));

alter table public.collectes
drop constraint if exists collectes_frequence_check;

alter table public.collectes
add constraint collectes_frequence_check
check (frequence in ('weekly', 'biweekly'));

alter table public.collectes
drop constraint if exists collectes_semaines_alternees_check;

alter table public.collectes
add constraint collectes_semaines_alternees_check
check (semaines_alternees in ('A', 'B') or semaines_alternees is null);

alter table public.collectes
add constraint collectes_family_type_unique unique (family_id, type);

create index if not exists collectes_family_type_idx on public.collectes(family_id, type);

create or replace function public.set_collectes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_collectes_updated_at on public.collectes;
create trigger trg_collectes_updated_at
before update on public.collectes
for each row
execute function public.set_collectes_updated_at();
