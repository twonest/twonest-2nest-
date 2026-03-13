insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do update set public = false;

drop policy if exists "receipts_read_authenticated" on storage.objects;
create policy "receipts_read_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'receipts');

drop policy if exists "receipts_insert_own" on storage.objects;
create policy "receipts_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "receipts_update_own" on storage.objects;
create policy "receipts_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'receipts'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'receipts'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "receipts_delete_own" on storage.objects;
create policy "receipts_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'receipts'
  and split_part(name, '/', 1) = auth.uid()::text
);
