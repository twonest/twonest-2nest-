create extension if not exists pgcrypto;

create table if not exists public.expense_reviews (
  id uuid primary key default gen_random_uuid(),
  expense_id text not null,
  requester_user_id uuid references auth.users(id) on delete set null,
  reviewer_role text not null default 'parent2' check (reviewer_role in ('parent1', 'parent2')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'contested')),
  contest_reason text,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists expense_reviews_expense_id_uidx on public.expense_reviews(expense_id);
create index if not exists expense_reviews_status_idx on public.expense_reviews(status);
create index if not exists expense_reviews_reviewer_role_idx on public.expense_reviews(reviewer_role);

alter table public.expense_reviews enable row level security;

drop policy if exists "expense_reviews_select_authenticated" on public.expense_reviews;
create policy "expense_reviews_select_authenticated"
on public.expense_reviews
for select
to authenticated
using (true);

drop policy if exists "expense_reviews_insert_own" on public.expense_reviews;
create policy "expense_reviews_insert_own"
on public.expense_reviews
for insert
to authenticated
with check (auth.uid() = requester_user_id);

drop policy if exists "expense_reviews_update_not_requester" on public.expense_reviews;
create policy "expense_reviews_update_not_requester"
on public.expense_reviews
for update
to authenticated
using (auth.uid() is distinct from requester_user_id)
with check (auth.uid() is distinct from requester_user_id);
