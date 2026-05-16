-- MekLoc - Security hardening (safe / non-destructive)
-- Run manually in Supabase SQL editor.

begin;

-- Optional columns used by settings/profile screens.
alter table public.agencies add column if not exists logo_url text;
alter table public.agencies add column if not exists address text;
alter table public.agencies add column if not exists phone text;
alter table public.agencies add column if not exists email text;

-- Positive numeric guards.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vehicles_daily_price_non_negative') then
    alter table public.vehicles add constraint vehicles_daily_price_non_negative check (daily_price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vehicles_mileage_non_negative') then
    alter table public.vehicles add constraint vehicles_mileage_non_negative check (mileage >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservations_total_amount_non_negative') then
    alter table public.reservations add constraint reservations_total_amount_non_negative check (coalesce(total_amount, 0) >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservations_daily_price_non_negative') then
    alter table public.reservations add constraint reservations_daily_price_non_negative check (daily_price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservations_deposit_non_negative') then
    alter table public.reservations add constraint reservations_deposit_non_negative check (deposit >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_amount_non_negative') then
    alter table public.payments add constraint payments_amount_non_negative check (amount >= 0);
  end if;
end $$;

-- Helpful indexes.
create index if not exists idx_clients_agency_email on public.clients (agency_id, email);
create index if not exists idx_vehicles_agency_status on public.vehicles (agency_id, status);
create index if not exists idx_reservations_agency_vehicle_dates on public.reservations (agency_id, vehicle_id, pickup_date, return_date);
create index if not exists idx_payments_agency_due_date on public.payments (agency_id, due_date);

-- Case-insensitive duplicate protection for access requests email.
create unique index if not exists access_requests_email_unique_idx on public.access_requests (lower(email));

-- Storage policies (agency-scoped) for common buckets.
-- NOTE: Requires authenticated users with users_profiles row.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'mekloc_storage_select_agency_scoped'
  ) then
    create policy mekloc_storage_select_agency_scoped
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id in ('logos', 'agency-assets', 'vehicle-images', 'client-documents', 'contracts')
        and split_part(name, '/', 1) = (
          select up.agency_id::text
          from public.users_profiles up
          where up.id = auth.uid()
          limit 1
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'mekloc_storage_insert_agency_scoped'
  ) then
    create policy mekloc_storage_insert_agency_scoped
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id in ('logos', 'agency-assets', 'vehicle-images', 'client-documents', 'contracts')
        and split_part(name, '/', 1) = (
          select up.agency_id::text
          from public.users_profiles up
          where up.id = auth.uid()
          limit 1
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'mekloc_storage_update_agency_scoped'
  ) then
    create policy mekloc_storage_update_agency_scoped
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id in ('logos', 'agency-assets', 'vehicle-images', 'client-documents', 'contracts')
        and split_part(name, '/', 1) = (
          select up.agency_id::text
          from public.users_profiles up
          where up.id = auth.uid()
          limit 1
        )
      )
      with check (
        bucket_id in ('logos', 'agency-assets', 'vehicle-images', 'client-documents', 'contracts')
        and split_part(name, '/', 1) = (
          select up.agency_id::text
          from public.users_profiles up
          where up.id = auth.uid()
          limit 1
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'mekloc_storage_delete_agency_scoped'
  ) then
    create policy mekloc_storage_delete_agency_scoped
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id in ('logos', 'agency-assets', 'vehicle-images', 'client-documents', 'contracts')
        and split_part(name, '/', 1) = (
          select up.agency_id::text
          from public.users_profiles up
          where up.id = auth.uid()
          limit 1
        )
      );
  end if;
end $$;

commit;
