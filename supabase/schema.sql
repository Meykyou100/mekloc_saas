create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  logo_path text,
  created_by uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  billing_status text not null default 'trial' check (billing_status in ('trial', 'paid', 'unpaid', 'overdue', 'cancelled')),
  subscription_start_date date,
  subscription_end_date date,
  last_payment_date date,
  next_payment_due_date date,
  monthly_price numeric(12, 2) not null default 0,
  payment_method text not null default 'other' check (payment_method in ('cash', 'bank_transfer', 'card', 'other')),
  payment_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid references public.agencies(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role text not null default 'Admin' check (role in ('Admin', 'Manager', 'Staff')),
  account_status text not null default 'pending' check (account_status in ('pending', 'active', 'rejected', 'suspended')),
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agencies add column if not exists plan text not null default 'free';
alter table public.agencies add column if not exists billing_status text not null default 'trial';
alter table public.agencies add column if not exists subscription_start_date date;
alter table public.agencies add column if not exists subscription_end_date date;
alter table public.agencies add column if not exists last_payment_date date;
alter table public.agencies add column if not exists next_payment_due_date date;
alter table public.agencies add column if not exists monthly_price numeric(12, 2) not null default 0;
alter table public.agencies add column if not exists payment_method text not null default 'other';
alter table public.agencies add column if not exists payment_notes text not null default '';
alter table public.users_profiles alter column agency_id drop not null;
alter table public.users_profiles add column if not exists email text;
alter table public.users_profiles add column if not exists phone text;
alter table public.users_profiles add column if not exists account_status text not null default 'pending';
alter table public.users_profiles add column if not exists is_super_admin boolean not null default false;

create or replace function public.current_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from public.users_profiles where id = auth.uid() limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_super_admin from public.users_profiles where id = auth.uid() limit 1),
    false
  );
$$;

create or replace function public.can_access_agency_data(target_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.users_profiles
      join public.agencies on agencies.id = users_profiles.agency_id
      where users_profiles.id = auth.uid()
        and users_profiles.agency_id = target_agency_id
        and users_profiles.account_status = 'active'
        and agencies.billing_status in ('paid', 'trial')
    );
$$;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  brand text not null,
  model text not null,
  plate_number text not null,
  year integer not null,
  mileage integer not null default 0,
  fuel_type text not null,
  transmission text not null,
  daily_price numeric(12, 2) not null default 0,
  status text not null default 'Available' check (status in ('Available', 'Rented', 'Maintenance', 'Unavailable')),
  insurance_expiry date not null,
  technical_inspection_date date not null,
  city text not null default '',
  revenue numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, plate_number)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null,
  cin_passport text not null,
  driving_license_number text not null,
  address text not null default '',
  total_rentals integer not null default 0,
  total_spent numeric(12, 2) not null default 0,
  status text not null default 'New' check (status in ('VIP', 'Regular', 'New')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  reservation_number text not null,
  client_id uuid not null references public.clients(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  pickup_date date not null,
  return_date date not null,
  daily_price numeric(12, 2) not null default 0,
  deposit numeric(12, 2) not null default 0,
  status text not null default 'Confirmed' check (status in ('Confirmed', 'Active', 'Completed', 'Cancelled')),
  notes text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, reservation_number),
  check (return_date >= pickup_date)
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  contract_number text not null,
  client_id uuid not null references public.clients(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  template text not null default 'Standard rental',
  pickup_date date not null,
  return_date date not null,
  total_amount numeric(12, 2) not null default 0,
  terms text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'Signed', 'Downloaded')),
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, contract_number),
  check (return_date >= pickup_date)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  invoice text not null,
  client_id uuid not null references public.clients(id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  amount numeric(12, 2) not null default 0,
  method text not null default 'Cash' check (method in ('Cash', 'Card', 'Bank transfer')),
  status text not null default 'Pending' check (status in ('Paid', 'Partial', 'Pending', 'Late')),
  due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, invoice)
);

create table if not exists public.maintenance (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  service_type text not null default 'Autre',
  type text not null default 'Autre',
  last_service_date date,
  next_service_date date,
  service_date date,
  current_mileage integer not null default 0,
  mileage_at_service integer not null default 0,
  next_service_mileage integer not null default 0,
  cost numeric(12, 2) not null default 0,
  provider_name text not null default '',
  status text not null default 'Planned',
  notes text not null default '',
  invoice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.maintenance add column if not exists service_type text not null default 'Autre';
alter table public.maintenance add column if not exists type text not null default 'Autre';
alter table public.maintenance add column if not exists last_service_date date;
alter table public.maintenance add column if not exists next_service_date date;
alter table public.maintenance add column if not exists service_date date;
alter table public.maintenance add column if not exists current_mileage integer not null default 0;
alter table public.maintenance add column if not exists mileage_at_service integer not null default 0;
alter table public.maintenance add column if not exists next_service_mileage integer not null default 0;
alter table public.maintenance add column if not exists provider_name text not null default '';
alter table public.maintenance add column if not exists notes text not null default '';
alter table public.maintenance add column if not exists invoice_url text;

create index if not exists users_profiles_agency_id_idx on public.users_profiles(agency_id);
create index if not exists vehicles_agency_id_idx on public.vehicles(agency_id);
create index if not exists clients_agency_id_idx on public.clients(agency_id);
create index if not exists reservations_agency_id_idx on public.reservations(agency_id);
create index if not exists contracts_agency_id_idx on public.contracts(agency_id);
create index if not exists payments_agency_id_idx on public.payments(agency_id);
create index if not exists payments_reservation_id_idx on public.payments(reservation_id);
create index if not exists payments_vehicle_id_idx on public.payments(vehicle_id);
create index if not exists maintenance_agency_id_idx on public.maintenance(agency_id);

drop trigger if exists set_agencies_updated_at on public.agencies;
create trigger set_agencies_updated_at before update on public.agencies
for each row execute function public.set_updated_at();

drop trigger if exists set_users_profiles_updated_at on public.users_profiles;
create trigger set_users_profiles_updated_at before update on public.users_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_vehicles_updated_at on public.vehicles;
create trigger set_vehicles_updated_at before update on public.vehicles
for each row execute function public.set_updated_at();

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists set_reservations_updated_at on public.reservations;
create trigger set_reservations_updated_at before update on public.reservations
for each row execute function public.set_updated_at();

drop trigger if exists set_contracts_updated_at on public.contracts;
create trigger set_contracts_updated_at before update on public.contracts
for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists set_maintenance_updated_at on public.maintenance;
create trigger set_maintenance_updated_at before update on public.maintenance
for each row execute function public.set_updated_at();

alter table public.agencies enable row level security;
alter table public.users_profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.clients enable row level security;
alter table public.reservations enable row level security;
alter table public.contracts enable row level security;
alter table public.payments enable row level security;
alter table public.maintenance enable row level security;

drop policy if exists "Agencies are visible to their members" on public.agencies;
create policy "Agencies are visible to their members"
on public.agencies for select
to authenticated
using (public.is_super_admin() or id = public.current_agency_id() or created_by = auth.uid());

drop policy if exists "Users can create their first agency" on public.agencies;
create policy "Users can create their first agency"
on public.agencies for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Agency members can update agency" on public.agencies;
create policy "Agency members can update agency"
on public.agencies for update
to authenticated
using (public.is_super_admin() or id = public.current_agency_id())
with check (public.is_super_admin() or id = public.current_agency_id());

drop policy if exists "Profiles are visible inside agency" on public.users_profiles;
create policy "Profiles are visible inside agency"
on public.users_profiles for select
to authenticated
using (public.is_super_admin() or id = auth.uid() or agency_id = public.current_agency_id());

drop policy if exists "Users can create own profile for own agency" on public.users_profiles;
create policy "Users can create own profile for own agency"
on public.users_profiles for insert
to authenticated
with check (
  id = auth.uid()
  and exists (
    select 1 from public.agencies
    where agencies.id = users_profiles.agency_id
    and agencies.created_by = auth.uid()
  )
);

drop policy if exists "Agency members can update profiles" on public.users_profiles;
create policy "Agency members can update profiles"
on public.users_profiles for update
to authenticated
using (public.is_super_admin() or agency_id = public.current_agency_id())
with check (public.is_super_admin() or agency_id = public.current_agency_id());

drop policy if exists "Agency rows are visible" on public.vehicles;
create policy "Agency rows are visible" on public.vehicles for select to authenticated using (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be inserted" on public.vehicles;
create policy "Agency rows can be inserted" on public.vehicles for insert to authenticated with check (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be updated" on public.vehicles;
create policy "Agency rows can be updated" on public.vehicles for update to authenticated using (public.can_access_agency_data(agency_id)) with check (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be deleted" on public.vehicles;
create policy "Agency rows can be deleted" on public.vehicles for delete to authenticated using (public.can_access_agency_data(agency_id));

drop policy if exists "Agency rows are visible" on public.clients;
create policy "Agency rows are visible" on public.clients for select to authenticated using (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be inserted" on public.clients;
create policy "Agency rows can be inserted" on public.clients for insert to authenticated with check (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be updated" on public.clients;
create policy "Agency rows can be updated" on public.clients for update to authenticated using (public.can_access_agency_data(agency_id)) with check (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be deleted" on public.clients;
create policy "Agency rows can be deleted" on public.clients for delete to authenticated using (public.can_access_agency_data(agency_id));

drop policy if exists "Agency rows are visible" on public.reservations;
create policy "Agency rows are visible" on public.reservations for select to authenticated using (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be inserted" on public.reservations;
create policy "Agency rows can be inserted" on public.reservations for insert to authenticated with check (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be updated" on public.reservations;
create policy "Agency rows can be updated" on public.reservations for update to authenticated using (public.can_access_agency_data(agency_id)) with check (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be deleted" on public.reservations;
create policy "Agency rows can be deleted" on public.reservations for delete to authenticated using (public.can_access_agency_data(agency_id));

drop policy if exists "Agency rows are visible" on public.contracts;
create policy "Agency rows are visible" on public.contracts for select to authenticated using (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be inserted" on public.contracts;
create policy "Agency rows can be inserted" on public.contracts for insert to authenticated with check (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be updated" on public.contracts;
create policy "Agency rows can be updated" on public.contracts for update to authenticated using (public.can_access_agency_data(agency_id)) with check (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be deleted" on public.contracts;
create policy "Agency rows can be deleted" on public.contracts for delete to authenticated using (public.can_access_agency_data(agency_id));

drop policy if exists "Agency rows are visible" on public.payments;
create policy "Agency rows are visible" on public.payments for select to authenticated using (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be inserted" on public.payments;
create policy "Agency rows can be inserted" on public.payments for insert to authenticated with check (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be updated" on public.payments;
create policy "Agency rows can be updated" on public.payments for update to authenticated using (public.can_access_agency_data(agency_id)) with check (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be deleted" on public.payments;
create policy "Agency rows can be deleted" on public.payments for delete to authenticated using (public.can_access_agency_data(agency_id));

drop policy if exists "Agency rows are visible" on public.maintenance;
create policy "Agency rows are visible" on public.maintenance for select to authenticated using (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be inserted" on public.maintenance;
create policy "Agency rows can be inserted" on public.maintenance for insert to authenticated with check (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be updated" on public.maintenance;
create policy "Agency rows can be updated" on public.maintenance for update to authenticated using (public.can_access_agency_data(agency_id)) with check (public.can_access_agency_data(agency_id));
drop policy if exists "Agency rows can be deleted" on public.maintenance;
create policy "Agency rows can be deleted" on public.maintenance for delete to authenticated using (public.can_access_agency_data(agency_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos', 'logos', false, 5242880, array['image/png', 'image/jpeg', 'image/svg+xml']),
  ('contract-pdfs', 'contract-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Agency members can read logos" on storage.objects;
create policy "Agency members can read logos"
on storage.objects for select
to authenticated
using (bucket_id = 'logos' and (public.is_super_admin() or (storage.foldername(name))[1] = public.current_agency_id()::text));

drop policy if exists "Agency members can upload logos" on storage.objects;
create policy "Agency members can upload logos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'logos' and (public.is_super_admin() or (storage.foldername(name))[1] = public.current_agency_id()::text));

drop policy if exists "Agency members can update logos" on storage.objects;
create policy "Agency members can update logos"
on storage.objects for update
to authenticated
using (bucket_id = 'logos' and (public.is_super_admin() or (storage.foldername(name))[1] = public.current_agency_id()::text))
with check (bucket_id = 'logos' and (public.is_super_admin() or (storage.foldername(name))[1] = public.current_agency_id()::text));

drop policy if exists "Agency members can delete logos" on storage.objects;
create policy "Agency members can delete logos"
on storage.objects for delete
to authenticated
using (bucket_id = 'logos' and (public.is_super_admin() or (storage.foldername(name))[1] = public.current_agency_id()::text));

drop policy if exists "Agency members can read contract pdfs" on storage.objects;
create policy "Agency members can read contract pdfs"
on storage.objects for select
to authenticated
using (bucket_id = 'contract-pdfs' and (public.is_super_admin() or (storage.foldername(name))[1] = public.current_agency_id()::text));

drop policy if exists "Agency members can upload contract pdfs" on storage.objects;
create policy "Agency members can upload contract pdfs"
on storage.objects for insert
to authenticated
with check (bucket_id = 'contract-pdfs' and (public.is_super_admin() or (storage.foldername(name))[1] = public.current_agency_id()::text));

drop policy if exists "Agency members can update contract pdfs" on storage.objects;
create policy "Agency members can update contract pdfs"
on storage.objects for update
to authenticated
using (bucket_id = 'contract-pdfs' and (public.is_super_admin() or (storage.foldername(name))[1] = public.current_agency_id()::text))
with check (bucket_id = 'contract-pdfs' and (public.is_super_admin() or (storage.foldername(name))[1] = public.current_agency_id()::text));

drop policy if exists "Agency members can delete contract pdfs" on storage.objects;
create policy "Agency members can delete contract pdfs"
on storage.objects for delete
to authenticated
using (bucket_id = 'contract-pdfs' and (public.is_super_admin() or (storage.foldername(name))[1] = public.current_agency_id()::text));
