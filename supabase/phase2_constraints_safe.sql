-- Phase 2 Safe Constraints & Index Draft
-- Non-destructive only:
-- - creates enums if missing
-- - creates indexes IF NOT EXISTS
-- - adds NOT VALID foreign keys (do not scan/fail existing data)
-- No deletes, no drops, no type rewrites.

-- 1) Enum types (safe create)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'reservation_status_enum') then
    create type public.reservation_status_enum as enum ('Confirmed', 'Active', 'Completed', 'Cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status_enum') then
    create type public.payment_status_enum as enum ('Paid', 'Partial', 'Pending', 'Late');
  end if;
  if not exists (select 1 from pg_type where typname = 'account_status_enum') then
    create type public.account_status_enum as enum ('pending', 'active', 'rejected', 'suspended');
  end if;
  if not exists (select 1 from pg_type where typname = 'billing_status_enum') then
    create type public.billing_status_enum as enum ('trial', 'paid', 'unpaid', 'overdue', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'access_request_status_enum') then
    create type public.access_request_status_enum as enum ('pending', 'pending_verification', 'contacted', 'payment_pending', 'approved', 'rejected', 'verified');
  end if;
end $$;

-- 2) Safe indexes
create index if not exists idx_vehicles_agency_id on public.vehicles (agency_id);
create index if not exists idx_clients_agency_id on public.clients (agency_id);
create index if not exists idx_reservations_agency_id on public.reservations (agency_id);
create index if not exists idx_reservations_client_id on public.reservations (client_id);
create index if not exists idx_reservations_vehicle_id on public.reservations (vehicle_id);
create index if not exists idx_reservations_pickup_date on public.reservations (pickup_date);
create index if not exists idx_reservations_return_date on public.reservations (return_date);
create index if not exists idx_contracts_agency_id on public.contracts (agency_id);
create index if not exists idx_contracts_client_id on public.contracts (client_id);
create index if not exists idx_contracts_vehicle_id on public.contracts (vehicle_id);
create index if not exists idx_contracts_reservation_id on public.contracts (reservation_id);
create index if not exists idx_payments_agency_id on public.payments (agency_id);
create index if not exists idx_payments_client_id on public.payments (client_id);
create index if not exists idx_payments_reservation_id on public.payments (reservation_id);
create index if not exists idx_payments_due_date on public.payments (due_date);
create index if not exists idx_maintenance_agency_id on public.maintenance (agency_id);
create index if not exists idx_maintenance_vehicle_id on public.maintenance (vehicle_id);
create index if not exists idx_users_profiles_agency_id on public.users_profiles (agency_id);
create unique index if not exists idx_access_requests_email_ci on public.access_requests (lower(email));

-- 3) Safe check constraints (NOT VALID)
alter table public.reservations
  add constraint if not exists reservations_status_check
  check (status in ('Confirmed', 'Active', 'Completed', 'Cancelled')) not valid;

alter table public.payments
  add constraint if not exists payments_status_check
  check (status in ('Paid', 'Partial', 'Pending', 'Late')) not valid;

alter table public.users_profiles
  add constraint if not exists users_profiles_account_status_check
  check (account_status in ('pending', 'active', 'rejected', 'suspended')) not valid;

alter table public.agencies
  add constraint if not exists agencies_billing_status_check
  check (billing_status in ('trial', 'paid', 'unpaid', 'overdue', 'cancelled')) not valid;

alter table public.access_requests
  add constraint if not exists access_requests_status_check
  check (status in ('pending', 'pending_verification', 'contacted', 'payment_pending', 'approved', 'rejected', 'verified')) not valid;

-- 4) Safe foreign keys (NOT VALID)
alter table public.vehicles
  add constraint if not exists vehicles_agency_id_fkey_safe
  foreign key (agency_id) references public.agencies(id) not valid;

alter table public.clients
  add constraint if not exists clients_agency_id_fkey_safe
  foreign key (agency_id) references public.agencies(id) not valid;

alter table public.reservations
  add constraint if not exists reservations_agency_id_fkey_safe
  foreign key (agency_id) references public.agencies(id) not valid;
alter table public.reservations
  add constraint if not exists reservations_client_id_fkey_safe
  foreign key (client_id) references public.clients(id) not valid;
alter table public.reservations
  add constraint if not exists reservations_vehicle_id_fkey_safe
  foreign key (vehicle_id) references public.vehicles(id) not valid;

alter table public.contracts
  add constraint if not exists contracts_agency_id_fkey_safe
  foreign key (agency_id) references public.agencies(id) not valid;
alter table public.contracts
  add constraint if not exists contracts_client_id_fkey_safe
  foreign key (client_id) references public.clients(id) not valid;
alter table public.contracts
  add constraint if not exists contracts_vehicle_id_fkey_safe
  foreign key (vehicle_id) references public.vehicles(id) not valid;
alter table public.contracts
  add constraint if not exists contracts_reservation_id_fkey_safe
  foreign key (reservation_id) references public.reservations(id) not valid;

alter table public.payments
  add constraint if not exists payments_agency_id_fkey_safe
  foreign key (agency_id) references public.agencies(id) not valid;
alter table public.payments
  add constraint if not exists payments_client_id_fkey_safe
  foreign key (client_id) references public.clients(id) not valid;
alter table public.payments
  add constraint if not exists payments_reservation_id_fkey_safe
  foreign key (reservation_id) references public.reservations(id) not valid;

alter table public.maintenance
  add constraint if not exists maintenance_agency_id_fkey_safe
  foreign key (agency_id) references public.agencies(id) not valid;
alter table public.maintenance
  add constraint if not exists maintenance_vehicle_id_fkey_safe
  foreign key (vehicle_id) references public.vehicles(id) not valid;

alter table public.users_profiles
  add constraint if not exists users_profiles_agency_id_fkey_safe
  foreign key (agency_id) references public.agencies(id) not valid;

-- NOTE:
-- After manual cleanup using phase2_backfill_plan.sql,
-- run VALIDATE CONSTRAINT per table progressively.

