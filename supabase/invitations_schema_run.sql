create extension if not exists pgcrypto;

create table if not exists public.invitations (
  id uuid default gen_random_uuid() primary key,
  email_invite text,
  family_id uuid,
  role text default 'parent',
  token uuid default gen_random_uuid(),
  statut text default 'en_attente',
  created_by uuid,
  created_at timestamp default now()
);

alter table invitations disable row level security;

create index if not exists invitations_family_id_idx on public.invitations(family_id);
create index if not exists invitations_email_invite_idx on public.invitations(lower(email_invite));
create unique index if not exists invitations_token_uidx on public.invitations(token);
