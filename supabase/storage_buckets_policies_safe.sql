-- MekLoc - Storage buckets and agency-scoped policies.
-- Safe to run multiple times. The first storage path segment must be the agency_id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos', 'logos', false, 5242880, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']),
  ('agency-assets', 'agency-assets', false, 5242880, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']),
  ('vehicle-images', 'vehicle-images', true, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('client-documents', 'client-documents', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  ('contract-pdfs', 'contract-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists mekloc_storage_select_agency_scoped on storage.objects;
create policy mekloc_storage_select_agency_scoped
on storage.objects
for select
to authenticated
using (
  bucket_id in ('logos', 'agency-assets', 'vehicle-images', 'client-documents', 'contract-pdfs')
  and (
    public.is_super_admin()
    or split_part(name, '/', 1) = public.current_agency_id()::text
  )
);

drop policy if exists mekloc_storage_insert_agency_scoped on storage.objects;
create policy mekloc_storage_insert_agency_scoped
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('logos', 'agency-assets', 'vehicle-images', 'client-documents', 'contract-pdfs')
  and (
    public.is_super_admin()
    or split_part(name, '/', 1) = public.current_agency_id()::text
  )
);

drop policy if exists mekloc_storage_update_agency_scoped on storage.objects;
create policy mekloc_storage_update_agency_scoped
on storage.objects
for update
to authenticated
using (
  bucket_id in ('logos', 'agency-assets', 'vehicle-images', 'client-documents', 'contract-pdfs')
  and (
    public.is_super_admin()
    or split_part(name, '/', 1) = public.current_agency_id()::text
  )
)
with check (
  bucket_id in ('logos', 'agency-assets', 'vehicle-images', 'client-documents', 'contract-pdfs')
  and (
    public.is_super_admin()
    or split_part(name, '/', 1) = public.current_agency_id()::text
  )
);

drop policy if exists mekloc_storage_delete_agency_scoped on storage.objects;
create policy mekloc_storage_delete_agency_scoped
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('logos', 'agency-assets', 'vehicle-images', 'client-documents', 'contract-pdfs')
  and (
    public.is_super_admin()
    or split_part(name, '/', 1) = public.current_agency_id()::text
  )
);

-- If an old "contracts" bucket exists from a previous migration, leave it untouched here.
-- Supabase blocks direct deletion from storage tables; remove it manually from Storage UI/API only after confirming it is empty.
