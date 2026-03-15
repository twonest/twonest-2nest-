create extension if not exists pgcrypto;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text,
  attachment_url text,
  attachment_name text,
  attachment_type text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_content_or_attachment check (
    coalesce(length(trim(content)), 0) > 0
    or attachment_url is not null
  )
);

alter table if exists public.messages add column if not exists family_id uuid references public.families(id) on delete cascade;
alter table if exists public.messages add column if not exists sender_id uuid references auth.users(id) on delete cascade;
alter table if exists public.messages add column if not exists content text;
alter table if exists public.messages add column if not exists attachment_url text;
alter table if exists public.messages add column if not exists attachment_name text;
alter table if exists public.messages add column if not exists attachment_type text;
alter table if exists public.messages add column if not exists created_at timestamptz default now();
alter table if exists public.messages add column if not exists read_at timestamptz;

create index if not exists messages_family_id_created_at_idx on public.messages(family_id, created_at);
create index if not exists messages_family_id_read_at_idx on public.messages(family_id, read_at);
create index if not exists messages_sender_id_idx on public.messages(sender_id);

alter table public.messages enable row level security;

drop policy if exists "messages_select_family_member" on public.messages;
create policy "messages_select_family_member"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members as fm
    where fm.family_id = messages.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.family_members as fm
    where fm.family_id = messages.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists "messages_update_read_receipts" on public.messages;
create policy "messages_update_read_receipts"
on public.messages
for update
to authenticated
using (
  exists (
    select 1
    from public.family_members as fm
    where fm.family_id = messages.family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
)
with check (
  read_at is not null
);

create or replace function public.prevent_message_content_update()
returns trigger
language plpgsql
as $$
begin
  if (new.content is distinct from old.content)
     or (new.attachment_url is distinct from old.attachment_url)
     or (new.attachment_name is distinct from old.attachment_name)
     or (new.attachment_type is distinct from old.attachment_type)
     or (new.sender_id is distinct from old.sender_id)
     or (new.family_id is distinct from old.family_id)
     or (new.created_at is distinct from old.created_at) then
    raise exception 'Messages cannot be modified after send';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_message_content_update on public.messages;
create trigger trg_prevent_message_content_update
before update on public.messages
for each row
execute function public.prevent_message_content_update();

drop policy if exists "messages_no_delete" on public.messages;
create policy "messages_no_delete"
on public.messages
for delete
to authenticated
using (false);

insert into storage.buckets (id, name, public)
values ('messages', 'messages', true)
on conflict (id) do nothing;

drop policy if exists "messages_bucket_read" on storage.objects;
create policy "messages_bucket_read"
on storage.objects
for select
to authenticated
using (bucket_id = 'messages');

drop policy if exists "messages_bucket_insert" on storage.objects;
create policy "messages_bucket_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'messages');
