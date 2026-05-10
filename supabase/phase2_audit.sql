-- Phase 2 Audit (read-only, schema-aware)
-- MekLoc: data quality and relational integrity checks
-- No writes, no deletes, no schema mutations.

-- ==========================================================
-- 0) Optional relation columns health check (never fails)
-- ==========================================================
drop table if exists pg_temp.audit_optional_relations;
create temporary table audit_optional_relations (
  relation_name text,
  status text,
  details text
);

do $$
declare
  has_col boolean;
  orphan_count bigint;
begin
  -- payments.invoice_id
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'invoice_id'
  ) into has_col;
  if has_col then
    execute $q$
      select count(*)
      from public.payments p
      left join public.invoices i on i.id = p.invoice_id
      where p.invoice_id is not null and i.id is null
    $q$ into orphan_count;
    insert into audit_optional_relations values (
      'payments.invoice_id',
      'ok',
      'orphan rows: ' || orphan_count::text
    );
  else
    insert into audit_optional_relations values (
      'payments.invoice_id',
      'missing',
      'payments.invoice_id missing - relation not enforced yet'
    );
  end if;

  -- payments.reservation_id
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'reservation_id'
  ) into has_col;
  if has_col then
    execute $q$
      select count(*)
      from public.payments p
      left join public.reservations r on r.id = p.reservation_id
      where p.reservation_id is not null and r.id is null
    $q$ into orphan_count;
    insert into audit_optional_relations values (
      'payments.reservation_id',
      'ok',
      'orphan rows: ' || orphan_count::text
    );
  else
    insert into audit_optional_relations values (
      'payments.reservation_id',
      'missing',
      'payments.reservation_id missing - relation not enforced yet'
    );
  end if;

  -- contracts.reservation_id
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contracts'
      and column_name = 'reservation_id'
  ) into has_col;
  if has_col then
    execute $q$
      select count(*)
      from public.contracts ct
      left join public.reservations r on r.id = ct.reservation_id
      where ct.reservation_id is not null and r.id is null
    $q$ into orphan_count;
    insert into audit_optional_relations values (
      'contracts.reservation_id',
      'ok',
      'orphan rows: ' || orphan_count::text
    );
  else
    insert into audit_optional_relations values (
      'contracts.reservation_id',
      'missing',
      'contracts.reservation_id missing - relation not enforced yet'
    );
  end if;

  -- maintenance_records.vehicle_id
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'maintenance_records'
      and column_name = 'vehicle_id'
  ) into has_col;
  if has_col then
    execute $q$
      select count(*)
      from public.maintenance_records m
      left join public.vehicles v on v.id = m.vehicle_id
      where m.vehicle_id is not null and v.id is null
    $q$ into orphan_count;
    insert into audit_optional_relations values (
      'maintenance_records.vehicle_id',
      'ok',
      'orphan rows: ' || orphan_count::text
    );
  else
    insert into audit_optional_relations values (
      'maintenance_records.vehicle_id',
      'missing',
      'maintenance_records.vehicle_id missing - relation not enforced yet'
    );
  end if;

  -- vehicles.agency_id
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vehicles'
      and column_name = 'agency_id'
  ) into has_col;
  if has_col then
    execute $q$
      select count(*) from public.vehicles where agency_id is null
    $q$ into orphan_count;
    insert into audit_optional_relations values (
      'vehicles.agency_id',
      'ok',
      'null agency rows: ' || orphan_count::text
    );
  else
    insert into audit_optional_relations values (
      'vehicles.agency_id',
      'missing',
      'vehicles.agency_id missing - relation not enforced yet'
    );
  end if;

  -- clients.agency_id
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clients'
      and column_name = 'agency_id'
  ) into has_col;
  if has_col then
    execute $q$
      select count(*) from public.clients where agency_id is null
    $q$ into orphan_count;
    insert into audit_optional_relations values (
      'clients.agency_id',
      'ok',
      'null agency rows: ' || orphan_count::text
    );
  else
    insert into audit_optional_relations values (
      'clients.agency_id',
      'missing',
      'clients.agency_id missing - relation not enforced yet'
    );
  end if;
end $$;

select * from audit_optional_relations order by relation_name;

-- ==========================================================
-- 1) Orphan reservations (required core relation checks)
-- ==========================================================
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

-- ==========================================================
-- 2) Orphan payments (safe when reservation_id missing)
-- ==========================================================
do $$
declare
  has_reservation_id boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'reservation_id'
  ) into has_reservation_id;

  if has_reservation_id then
    execute $q$
      drop table if exists pg_temp.audit_orphan_payments;
      create temporary table audit_orphan_payments as
      select
        p.id,
        p.agency_id,
        p.client_id,
        p.reservation_id,
        case
          when a.id is null then 'missing agency'
          when c.id is null then 'missing client'
          when p.reservation_id is not null and r.id is null then 'missing reservation'
          else 'ok'
        end as issue
      from public.payments p
      left join public.agencies a on a.id = p.agency_id
      left join public.clients c on c.id = p.client_id
      left join public.reservations r on r.id = p.reservation_id
      where a.id is null
         or c.id is null
         or (p.reservation_id is not null and r.id is null);
    $q$;
  else
    execute $q$
      drop table if exists pg_temp.audit_orphan_payments;
      create temporary table audit_orphan_payments as
      select
        p.id,
        p.agency_id,
        p.client_id,
        null::uuid as reservation_id,
        case
          when a.id is null then 'missing agency'
          when c.id is null then 'missing client'
          else 'payments.reservation_id missing - relation not enforced yet'
        end as issue
      from public.payments p
      left join public.agencies a on a.id = p.agency_id
      left join public.clients c on c.id = p.client_id
      where a.id is null
         or c.id is null;
    $q$;
  end if;
end $$;

select * from audit_orphan_payments order by id;

-- ==========================================================
-- 3) Orphan contracts (safe when reservation_id missing)
-- ==========================================================
do $$
declare
  has_reservation_id boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contracts'
      and column_name = 'reservation_id'
  ) into has_reservation_id;

  if has_reservation_id then
    execute $q$
      drop table if exists pg_temp.audit_orphan_contracts;
      create temporary table audit_orphan_contracts as
      select
        ct.id,
        ct.agency_id,
        ct.client_id,
        ct.vehicle_id,
        ct.reservation_id,
        case
          when a.id is null then 'missing agency'
          when c.id is null then 'missing client'
          when v.id is null then 'missing vehicle'
          when ct.reservation_id is not null and r.id is null then 'missing reservation'
          else 'ok'
        end as issue
      from public.contracts ct
      left join public.agencies a on a.id = ct.agency_id
      left join public.clients c on c.id = ct.client_id
      left join public.vehicles v on v.id = ct.vehicle_id
      left join public.reservations r on r.id = ct.reservation_id
      where a.id is null
         or c.id is null
         or v.id is null
         or (ct.reservation_id is not null and r.id is null);
    $q$;
  else
    execute $q$
      drop table if exists pg_temp.audit_orphan_contracts;
      create temporary table audit_orphan_contracts as
      select
        ct.id,
        ct.agency_id,
        ct.client_id,
        ct.vehicle_id,
        null::uuid as reservation_id,
        case
          when a.id is null then 'missing agency'
          when c.id is null then 'missing client'
          when v.id is null then 'missing vehicle'
          else 'contracts.reservation_id missing - relation not enforced yet'
        end as issue
      from public.contracts ct
      left join public.agencies a on a.id = ct.agency_id
      left join public.clients c on c.id = ct.client_id
      left join public.vehicles v on v.id = ct.vehicle_id
      where a.id is null
         or c.id is null
         or v.id is null;
    $q$;
  end if;
end $$;

select * from audit_orphan_contracts order by id;

-- ==========================================================
-- 4) Duplicated access_requests emails (case-insensitive)
-- ==========================================================
select
  lower(trim(email)) as normalized_email,
  count(*) as total_rows
from public.access_requests
where email is not null
  and trim(email) <> ''
group by lower(trim(email))
having count(*) > 1
order by total_rows desc;

-- ==========================================================
-- 5) Invalid statuses against expected values
-- ==========================================================
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

-- ==========================================================
-- 6) Missing foreign key constraints (schema-aware expected set)
-- ==========================================================
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
  select 'payments', 'invoice_id', 'invoices' union all
  select 'maintenance_records', 'agency_id', 'agencies' union all
  select 'maintenance_records', 'vehicle_id', 'vehicles' union all
  select 'users_profiles', 'agency_id', 'agencies' union all
  select 'vehicles', 'agency_id', 'agencies' union all
  select 'clients', 'agency_id', 'agencies'
),
existing_columns as (
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
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
select
  e.table_name,
  e.column_name,
  e.ref_table,
  case
    when ec.column_name is null then 'column missing - relation not enforced yet'
    when a.table_name is null then 'fk missing'
    else 'ok'
  end as audit_status
from expected_fk e
left join existing_columns ec
  on ec.table_name = e.table_name
 and ec.column_name = e.column_name
left join actual_fk a
  on a.table_name = e.table_name
 and a.column_name = e.column_name
 and a.ref_table = e.ref_table
where ec.column_name is null
   or a.table_name is null
order by e.table_name, e.column_name;
