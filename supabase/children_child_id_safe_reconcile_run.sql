with pending as (
  select
    'events' as table_name,
    count(*) as total_rows,
    count(*) filter (
      where nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as rows_with_child_label,
    count(*) filter (
      where child_id is null
        and nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as unresolved_child_id
  from public.events

  union all

  select
    'expenses' as table_name,
    count(*) as total_rows,
    count(*) filter (
      where nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as rows_with_child_label,
    count(*) filter (
      where child_id is null
        and nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as unresolved_child_id
  from public.expenses

  union all

  select
    'documents' as table_name,
    count(*) as total_rows,
    count(*) filter (
      where nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as rows_with_child_label,
    count(*) filter (
      where child_id is null
        and nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as unresolved_child_id
  from public.documents
)
select *
from pending
order by table_name;

with unresolved as (
  select
    'events'::text as source_table,
    e.id::text as source_id,
    e.user_id::text as source_user_id,
    e.family_id::text as source_family_id,
    nullif(trim(coalesce(e.child_name, e.enfant, '')), '') as raw_child_label,
    e.child_name,
    e.enfant,
    e.child_id::text as child_id_text
  from public.events e
  where e.child_id is null
    and nullif(trim(coalesce(e.child_name, e.enfant, '')), '') is not null

  union all

  select
    'expenses'::text as source_table,
    x.id::text as source_id,
    x.user_id::text as source_user_id,
    x.family_id::text as source_family_id,
    nullif(trim(coalesce(x.child_name, x.enfant, '')), '') as raw_child_label,
    x.child_name,
    x.enfant,
    x.child_id::text as child_id_text
  from public.expenses x
  where x.child_id is null
    and nullif(trim(coalesce(x.child_name, x.enfant, '')), '') is not null

  union all

  select
    'documents'::text as source_table,
    d.id::text as source_id,
    d.user_id::text as source_user_id,
    d.family_id::text as source_family_id,
    nullif(trim(coalesce(d.child_name, d.enfant, '')), '') as raw_child_label,
    d.child_name,
    d.enfant,
    d.child_id::text as child_id_text
  from public.documents d
  where d.child_id is null
    and nullif(trim(coalesce(d.child_name, d.enfant, '')), '') is not null
),
candidate_counts as (
  select
    u.*,
    (
      select count(*)
      from public.children c
      where coalesce(nullif(trim(c.first_name), ''), nullif(trim(c.last_name), '')) is not null
        and (
          lower(trim(u.raw_child_label)) = lower(trim(concat_ws(' ', c.first_name, c.last_name)))
          or lower(trim(u.raw_child_label)) = lower(trim(c.first_name))
        )
        and (
          (
            nullif(trim(coalesce(u.source_user_id, '')), '') is not null
            and nullif(trim(coalesce(c.user_id::text, '')), '') is not null
            and nullif(trim(coalesce(u.source_user_id, '')), '') = nullif(trim(coalesce(c.user_id::text, '')), '')
          )
          or (
            nullif(trim(coalesce(u.source_family_id, '')), '') is not null
            and nullif(trim(coalesce(c.family_id, '')), '') is not null
            and nullif(trim(coalesce(u.source_family_id, '')), '') = nullif(trim(coalesce(c.family_id, '')), '')
          )
          or (
            nullif(trim(coalesce(u.source_user_id, '')), '') is null
            and nullif(trim(coalesce(u.source_family_id, '')), '') is null
          )
        )
    ) as possible_children
  from unresolved u
)
select
  source_table,
  source_id,
  source_user_id,
  source_family_id,
  raw_child_label,
  child_name,
  enfant,
  possible_children
from candidate_counts
order by
  possible_children asc,
  source_table asc,
  raw_child_label asc
limit 50;

begin;

with candidates as (
  select
    e.id as row_id,
    c.id as resolved_child_id,
    trim(concat_ws(' ', c.first_name, c.last_name)) as resolved_child_name,
    case
      when lower(trim(coalesce(e.child_name, e.enfant, ''))) = lower(trim(concat_ws(' ', c.first_name, c.last_name))) then 2
      when lower(trim(coalesce(e.child_name, e.enfant, ''))) = lower(trim(c.first_name)) then 1
      else 0
    end as score
  from public.events e
  join public.children c
    on (
      (
        nullif(trim(coalesce(e.user_id::text, '')), '') is not null
        and nullif(trim(coalesce(c.user_id::text, '')), '') is not null
        and nullif(trim(coalesce(e.user_id::text, '')), '') = nullif(trim(coalesce(c.user_id::text, '')), '')
      )
      or
      (
        nullif(trim(coalesce(e.family_id::text, '')), '') is not null
        and nullif(trim(coalesce(c.family_id, '')), '') is not null
        and nullif(trim(coalesce(e.family_id::text, '')), '') = nullif(trim(coalesce(c.family_id, '')), '')
      )
    )
  where e.child_id is null
    and nullif(trim(coalesce(e.child_name, e.enfant, '')), '') is not null
    and coalesce(nullif(trim(c.first_name), ''), nullif(trim(c.last_name), '')) is not null
    and lower(trim(coalesce(e.child_name, e.enfant, ''))) in (
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
    row_number() over (partition by row_id order by score desc) as rn,
    count(*) over (partition by row_id, score) as score_count,
    count(*) over (partition by row_id) as total_count
  from candidates
  where score > 0
)
update public.events e
set
  child_id = r.resolved_child_id,
  child_name = coalesce(nullif(trim(e.child_name), ''), nullif(trim(r.resolved_child_name), '')),
  enfant = coalesce(nullif(trim(e.enfant), ''), nullif(trim(e.child_name), ''), nullif(trim(r.resolved_child_name), ''))
from ranked r
where e.id = r.row_id
  and e.child_id is null
  and r.rn = 1
  and r.score_count = 1
  and r.total_count = 1;

with candidates as (
  select
    x.id as row_id,
    c.id as resolved_child_id,
    trim(concat_ws(' ', c.first_name, c.last_name)) as resolved_child_name,
    case
      when lower(trim(coalesce(x.child_name, x.enfant, ''))) = lower(trim(concat_ws(' ', c.first_name, c.last_name))) then 2
      when lower(trim(coalesce(x.child_name, x.enfant, ''))) = lower(trim(c.first_name)) then 1
      else 0
    end as score
  from public.expenses x
  join public.children c
    on (
      (
        nullif(trim(coalesce(x.user_id::text, '')), '') is not null
        and nullif(trim(coalesce(c.user_id::text, '')), '') is not null
        and nullif(trim(coalesce(x.user_id::text, '')), '') = nullif(trim(coalesce(c.user_id::text, '')), '')
      )
      or
      (
        nullif(trim(coalesce(x.family_id::text, '')), '') is not null
        and nullif(trim(coalesce(c.family_id, '')), '') is not null
        and nullif(trim(coalesce(x.family_id::text, '')), '') = nullif(trim(coalesce(c.family_id, '')), '')
      )
    )
  where x.child_id is null
    and nullif(trim(coalesce(x.child_name, x.enfant, '')), '') is not null
    and coalesce(nullif(trim(c.first_name), ''), nullif(trim(c.last_name), '')) is not null
    and lower(trim(coalesce(x.child_name, x.enfant, ''))) in (
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
    row_number() over (partition by row_id order by score desc) as rn,
    count(*) over (partition by row_id, score) as score_count,
    count(*) over (partition by row_id) as total_count
  from candidates
  where score > 0
)
update public.expenses x
set
  child_id = r.resolved_child_id,
  child_name = coalesce(nullif(trim(x.child_name), ''), nullif(trim(r.resolved_child_name), '')),
  enfant = coalesce(nullif(trim(x.enfant), ''), nullif(trim(x.child_name), ''), nullif(trim(r.resolved_child_name), ''))
from ranked r
where x.id = r.row_id
  and x.child_id is null
  and r.rn = 1
  and r.score_count = 1
  and r.total_count = 1;

with candidates as (
  select
    d.id as row_id,
    c.id as resolved_child_id,
    trim(concat_ws(' ', c.first_name, c.last_name)) as resolved_child_name,
    case
      when lower(trim(coalesce(d.child_name, d.enfant, ''))) = lower(trim(concat_ws(' ', c.first_name, c.last_name))) then 2
      when lower(trim(coalesce(d.child_name, d.enfant, ''))) = lower(trim(c.first_name)) then 1
      else 0
    end as score
  from public.documents d
  join public.children c
    on (
      (
        nullif(trim(coalesce(d.user_id::text, '')), '') is not null
        and nullif(trim(coalesce(c.user_id::text, '')), '') is not null
        and nullif(trim(coalesce(d.user_id::text, '')), '') = nullif(trim(coalesce(c.user_id::text, '')), '')
      )
      or
      (
        nullif(trim(coalesce(d.family_id::text, '')), '') is not null
        and nullif(trim(coalesce(c.family_id, '')), '') is not null
        and nullif(trim(coalesce(d.family_id::text, '')), '') = nullif(trim(coalesce(c.family_id, '')), '')
      )
    )
  where d.child_id is null
    and nullif(trim(coalesce(d.child_name, d.enfant, '')), '') is not null
    and coalesce(nullif(trim(c.first_name), ''), nullif(trim(c.last_name), '')) is not null
    and lower(trim(coalesce(d.child_name, d.enfant, ''))) in (
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
    row_number() over (partition by row_id order by score desc) as rn,
    count(*) over (partition by row_id, score) as score_count,
    count(*) over (partition by row_id) as total_count
  from candidates
  where score > 0
)
update public.documents d
set
  child_id = r.resolved_child_id,
  child_name = coalesce(nullif(trim(d.child_name), ''), nullif(trim(r.resolved_child_name), '')),
  enfant = coalesce(nullif(trim(d.enfant), ''), nullif(trim(d.child_name), ''), nullif(trim(r.resolved_child_name), ''))
from ranked r
where d.id = r.row_id
  and d.child_id is null
  and r.rn = 1
  and r.score_count = 1
  and r.total_count = 1;

commit;

with pending as (
  select
    'events' as table_name,
    count(*) as total_rows,
    count(*) filter (
      where nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as rows_with_child_label,
    count(*) filter (
      where child_id is null
        and nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as unresolved_child_id
  from public.events

  union all

  select
    'expenses' as table_name,
    count(*) as total_rows,
    count(*) filter (
      where nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as rows_with_child_label,
    count(*) filter (
      where child_id is null
        and nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as unresolved_child_id
  from public.expenses

  union all

  select
    'documents' as table_name,
    count(*) as total_rows,
    count(*) filter (
      where nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as rows_with_child_label,
    count(*) filter (
      where child_id is null
        and nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as unresolved_child_id
  from public.documents
)
select *
from pending
order by table_name;
