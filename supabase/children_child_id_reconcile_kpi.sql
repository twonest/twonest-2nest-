with kpi as (
  select
    'events' as table_name,
    count(*) filter (where nullif(trim(coalesce(child_name, enfant, '')), '') is not null) as rows_with_child_label,
    count(*) filter (
      where child_id is null
        and nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as unresolved_child_id
  from public.events

  union all

  select
    'expenses' as table_name,
    count(*) filter (where nullif(trim(coalesce(child_name, enfant, '')), '') is not null) as rows_with_child_label,
    count(*) filter (
      where child_id is null
        and nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as unresolved_child_id
  from public.expenses

  union all

  select
    'documents' as table_name,
    count(*) filter (where nullif(trim(coalesce(child_name, enfant, '')), '') is not null) as rows_with_child_label,
    count(*) filter (
      where child_id is null
        and nullif(trim(coalesce(child_name, enfant, '')), '') is not null
    ) as unresolved_child_id
  from public.documents
)
select
  table_name,
  rows_with_child_label,
  unresolved_child_id,
  (rows_with_child_label - unresolved_child_id) as resolved_child_id,
  round(
    case
      when rows_with_child_label = 0 then 100
      else ((rows_with_child_label - unresolved_child_id)::numeric / rows_with_child_label::numeric) * 100
    end,
    2
  ) as resolved_pct
from kpi
order by table_name;
