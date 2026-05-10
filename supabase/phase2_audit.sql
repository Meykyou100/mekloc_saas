-- Phase 2 Audit (read-only)
-- MekLoc: data quality and relational integrity checks
-- No writes, no deletes, no schema mutations.

-- 1) Orphan reservations (missing vehicle/client/agency references)
select
  r.id,
  r.agency_id,
  r.client_id,
  r.vehicle_id
from public.reservations r
left join public.agencies a on a.id = r.agency_id
left join public.clients c on c.id = r.client_id
left join public.vehicles v on v.id = r.vehicle_id
where a.id is null
   or c.id is null
   or v.id is null;

-- 2) Orphan payments (missing reservation/client/agency references where applicable)
select
  p.id,
  p.agency_id,
  p.client_id,
  p.reservation_id
from public.payments p
left join public.agencies a on a.id = p.agency_id
left join public.clients c on c.id = p.client_id
left join public.reservations r on r.id = p.reservation_id
where a.id is null
   or c.id is null
   or (p.reservation_id is not null and r.id is null);

-- 3) Orphan contracts (missing reservation/client/vehicle/agency references)
select
  ct.id,
  ct.agency_id,
  ct.client_id,
  ct.vehicle_id,
  ct.reservation_id
from public.contracts ct
left join public.agencies a on a.id = ct.agency_id
left join public.clients c on c.id = ct.client_id
left join public.vehicles v on v.id = ct.vehicle_id
left join public.reservations r on r.id = ct.reservation_id
where a.id is null
   or c.id is null
   or v.id is null
   or (ct.reservation_id is not null and r.id is null);

-- 4) Vehicles without agency_id
select id, brand, model, plate_number, agency_id
from public.vehicles
where agency_id is null;

-- 5) Clients without agency_id
select id, full_name, email, agency_id
from public.clients
where agency_id is null;

-- 6) Duplicated access_requests emails (case-insensitive)
select
  lower(email) as normalized_email,
  count(*) as total_rows
from public.access_requests
group by lower(email)
having count(*) > 1
order by total_rows desc;

-- 7) Invalid statuses against expected values
-- Reservations
select id, status
from public.reservations
where status is null
   or status not in ('Confirmed', 'Active', 'Completed', 'Cancelled');

-- Payments
select id, status
from public.payments
where status is null
   or status not in ('Paid', 'Partial', 'Pending', 'Late');

-- Access requests
select id, status
from public.access_requests
where status is null
   or status not in ('pending', 'pending_verification', 'contacted', 'payment_pending', 'approved', 'rejected', 'verified');

-- Users profiles account status
select id, account_status
from public.users_profiles
where account_status is null
   or account_status not in ('pending', 'active', 'rejected', 'suspended');

-- Agencies billing status
select id, billing_status
from public.agencies
where billing_status is null
   or billing_status not in ('trial', 'paid', 'unpaid', 'overdue', 'cancelled');

-- 8) Missing foreign key constraints (expected FK names can vary; this checks by table/column relation)
with expected_fk as (
  select 'reservations'::text as table_name, 'agency_id'::text as column_name, 'agencies'::text as ref_table union all
  select 'reservations', 'client_id', 'clients' union all
  select 'reservations', 'vehicle_id', 'vehicles' union all
  select 'contracts', 'agency_id', 'agencies' union all
  select 'contracts', 'client_id', 'clients' union all
  select 'contracts', 'vehicle_id', 'vehicles' union all
  select 'contracts', 'reservation_id', 'reservations' union all
  select 'payments', 'agency_id', 'agencies' union all
  select 'payments', 'client_id', 'clients' union all
  select 'payments', 'reservation_id', 'reservations' union all
  select 'maintenance', 'agency_id', 'agencies' union all
  select 'maintenance', 'vehicle_id', 'vehicles' union all
  select 'users_profiles', 'agency_id', 'agencies' union all
  select 'vehicles', 'agency_id', 'agencies' union all
  select 'clients', 'agency_id', 'agencies'
),
actual_fk as (
  select
    tc.table_name,
    kcu.column_name,
    ccu.table_name as ref_table
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name
   and tc.table_schema = ccu.table_schema
  where tc.table_schema = 'public'
    and tc.constraint_type = 'FOREIGN KEY'
)
select e.*
from expected_fk e
left join actual_fk a
  on a.table_name = e.table_name
 and a.column_name = e.column_name
 and a.ref_table = e.ref_table
where a.table_name is null
order by e.table_name, e.column_name;

