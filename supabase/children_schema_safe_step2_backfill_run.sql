do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'prenom'
  ) then
    execute '
      update public.children
      set first_name = coalesce(nullif(trim(first_name), ''''), nullif(trim(prenom), ''''))
      where coalesce(nullif(trim(first_name), ''''), '''') = ''''
        and coalesce(nullif(trim(prenom), ''''), '''') <> ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'nom'
  ) then
    execute '
      update public.children
      set last_name = coalesce(nullif(trim(last_name), ''''), nullif(trim(nom), ''''))
      where coalesce(nullif(trim(last_name), ''''), '''') = ''''
        and coalesce(nullif(trim(nom), ''''), '''') <> ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'date_naissance'
  ) then
    execute '
      update public.children
      set birth_date = coalesce(birth_date, date_naissance)
      where birth_date is null
        and date_naissance is not null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'ecole'
  ) then
    execute '
      update public.children
      set school_name = coalesce(nullif(trim(school_name), ''''), nullif(trim(ecole), ''''))
      where coalesce(nullif(trim(school_name), ''''), '''') = ''''
        and coalesce(nullif(trim(ecole), ''''), '''') <> ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'niveau_scolaire'
  ) then
    execute '
      update public.children
      set school_level = coalesce(nullif(trim(school_level), ''''), nullif(trim(niveau_scolaire), ''''))
      where coalesce(nullif(trim(school_level), ''''), '''') = ''''
        and coalesce(nullif(trim(niveau_scolaire), ''''), '''') <> ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'medecin_nom'
  ) then
    execute '
      update public.children
      set doctor_name = coalesce(nullif(trim(doctor_name), ''''), nullif(trim(medecin_nom), ''''))
      where coalesce(nullif(trim(doctor_name), ''''), '''') = ''''
        and coalesce(nullif(trim(medecin_nom), ''''), '''') <> ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'medecin_telephone'
  ) then
    execute '
      update public.children
      set doctor_phone = coalesce(nullif(trim(doctor_phone), ''''), nullif(trim(medecin_telephone), ''''))
      where coalesce(nullif(trim(doctor_phone), ''''), '''') = ''''
        and coalesce(nullif(trim(medecin_telephone), ''''), '''') <> ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'dentiste_nom'
  ) then
    execute '
      update public.children
      set dentist_name = coalesce(nullif(trim(dentist_name), ''''), nullif(trim(dentiste_nom), ''''))
      where coalesce(nullif(trim(dentist_name), ''''), '''') = ''''
        and coalesce(nullif(trim(dentiste_nom), ''''), '''') <> ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'dentiste_telephone'
  ) then
    execute '
      update public.children
      set dentist_phone = coalesce(nullif(trim(dentist_phone), ''''), nullif(trim(dentiste_telephone), ''''))
      where coalesce(nullif(trim(dentist_phone), ''''), '''') = ''''
        and coalesce(nullif(trim(dentiste_telephone), ''''), '''') <> ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'groupe_sanguin'
  ) then
    execute '
      update public.children
      set blood_type = coalesce(nullif(trim(blood_type), ''''), nullif(trim(groupe_sanguin), ''''))
      where coalesce(nullif(trim(blood_type), ''''), '''') = ''''
        and coalesce(nullif(trim(groupe_sanguin), ''''), '''') <> ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'medicaments'
  ) then
    execute '
      update public.children
      set medications = coalesce(nullif(trim(medications), ''''), nullif(trim(medicaments), ''''))
      where coalesce(nullif(trim(medications), ''''), '''') = ''''
        and coalesce(nullif(trim(medicaments), ''''), '''') <> ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'numero_assurance_maladie'
  ) then
    execute '
      update public.children
      set health_insurance_number = coalesce(nullif(trim(health_insurance_number), ''''), nullif(trim(numero_assurance_maladie), ''''))
      where coalesce(nullif(trim(health_insurance_number), ''''), '''') = ''''
        and coalesce(nullif(trim(numero_assurance_maladie), ''''), '''') <> ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'emergency_contacts_json'
  ) then
    execute '
      update public.children
      set emergency_contacts = coalesce(emergency_contacts, emergency_contacts_json, ''[]''::jsonb)
      where emergency_contacts is null
    ';
  else
    execute '
      update public.children
      set emergency_contacts = ''[]''::jsonb
      where emergency_contacts is null
    ';
  end if;
end;
$$;

update public.children
set created_at = now()
where created_at is null;

update public.children
set updated_at = now()
where updated_at is null;

create or replace function public.backfill_child_links(target_table text)
returns void
language plpgsql
as $$
declare
  has_user_id boolean;
  has_family_id boolean;
  sql text;
  scope_filter text := 'true';
  child_id_expr text := 'null';
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = target_table
      and column_name = 'user_id'
  ) into has_user_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = target_table
      and column_name = 'family_id'
  ) into has_family_id;

  if has_user_id and has_family_id then
    scope_filter := '((nullif(trim(coalesce(t.user_id::text, '''')), '''') is not null and nullif(trim(coalesce(c.user_id::text, '''')), '''') is not null and nullif(trim(coalesce(t.user_id::text, '''')), '''') = nullif(trim(coalesce(c.user_id::text, '''')), '''')) or (nullif(trim(coalesce(t.family_id::text, '''')), '''') is not null and nullif(trim(coalesce(t.family_id::text, '''')), '''') = nullif(trim(coalesce(c.family_id, '''')), '''')))';
  elsif has_user_id then
    scope_filter := '(nullif(trim(coalesce(t.user_id::text, '''')), '''') is not null and nullif(trim(coalesce(c.user_id::text, '''')), '''') is not null and nullif(trim(coalesce(t.user_id::text, '''')), '''') = nullif(trim(coalesce(c.user_id::text, '''')), ''''))';
  elsif has_family_id then
    scope_filter := '(nullif(trim(coalesce(t.family_id::text, '''')), '''') is not null and nullif(trim(coalesce(t.family_id::text, '''')), '''') = nullif(trim(coalesce(c.family_id, '''')), ''''))';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'children'
      and column_name = 'id'
  ) then
    child_id_expr := 'case when nullif(trim(coalesce(c.id::text, '''')), '''') ~ ''^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'' then nullif(trim(coalesce(c.id::text, '''')), '''')::uuid else null end';
  end if;

  sql := format($fmt$
    with candidates as (
      select
        t.id as row_id,
        %s as resolved_child_id,
        trim(concat_ws(' ', c.first_name, c.last_name)) as resolved_child_name,
        case
          when lower(trim(coalesce(t.child_name, t.enfant, ''))) = lower(trim(concat_ws(' ', c.first_name, c.last_name))) then 2
          when lower(trim(coalesce(t.child_name, t.enfant, ''))) = lower(trim(c.first_name)) then 1
          else 0
        end as score
      from public.%I t
      join public.children c on %s
      where t.child_id is null
        and %s is not null
        and nullif(trim(coalesce(t.child_name, t.enfant, '')), '') is not null
        and coalesce(nullif(trim(c.first_name), ''), nullif(trim(c.last_name), '')) is not null
        and lower(trim(coalesce(t.child_name, t.enfant, ''))) in (
          lower(trim(concat_ws(' ', c.first_name, c.last_name))),
          lower(trim(c.first_name))
        )
    ),
    ranked as (
      select
        row_id,
        resolved_child_id,
        resolved_child_name,
        score,
        row_number() over (partition by row_id order by score desc, resolved_child_id) as rn,
        count(*) over (partition by row_id, score) as score_count
      from candidates
      where score > 0
    )
    update public.%I t
    set child_id = r.resolved_child_id,
        child_name = coalesce(nullif(trim(t.child_name), ''), nullif(trim(r.resolved_child_name), '')),
        enfant = coalesce(nullif(trim(t.enfant), ''), nullif(trim(t.child_name), ''), nullif(trim(r.resolved_child_name), ''))
    from ranked r
    where t.id = r.row_id
      and r.rn = 1
      and r.score_count = 1
      and t.child_id is null;
  $fmt$, child_id_expr, target_table, scope_filter, child_id_expr, target_table);

  execute sql;

  sql := format($fmt$
    update public.%I t
    set child_name = coalesce(nullif(trim(t.child_name), ''), trim(concat_ws(' ', c.first_name, c.last_name))),
        enfant = coalesce(nullif(trim(t.enfant), ''), nullif(trim(t.child_name), ''), trim(concat_ws(' ', c.first_name, c.last_name)))
    from public.children c
    where nullif(trim(coalesce(t.child_id::text, '')), '') is not null
      and nullif(trim(coalesce(c.id::text, '')), '') is not null
      and nullif(trim(coalesce(c.id::text, '')), '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      and nullif(trim(coalesce(t.child_id::text, '')), '') = nullif(trim(coalesce(c.id::text, '')), '')
      and (
        nullif(trim(coalesce(t.child_name, '')), '') is null
        or nullif(trim(coalesce(t.enfant, '')), '') is null
      );
  $fmt$, target_table);

  execute sql;
end;
$$;

select public.backfill_child_links('events');
select public.backfill_child_links('expenses');
select public.backfill_child_links('documents');

drop function if exists public.backfill_child_links(text);

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

alter table public.children alter column emergency_contacts set default '[]'::jsonb;
alter table public.children alter column created_at set default now();
alter table public.children alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from public.children
    where coalesce(nullif(trim(first_name), ''), nullif(trim(prenom), '')) is null
  ) then
    alter table public.children alter column first_name set not null;
  end if;

  if not exists (
    select 1
    from public.children
    where emergency_contacts is null
  ) then
    alter table public.children alter column emergency_contacts set not null;
  end if;

  if not exists (
    select 1
    from public.children
    where created_at is null
  ) then
    alter table public.children alter column created_at set not null;
  end if;

  if not exists (
    select 1
    from public.children
    where updated_at is null
  ) then
    alter table public.children alter column updated_at set not null;
  end if;
end;
$$;