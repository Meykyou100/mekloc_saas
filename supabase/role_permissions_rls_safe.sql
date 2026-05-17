-- MekLoc - Role based RLS hardening (safe / additive)
-- Run manually in Supabase SQL Editor after backup.
-- This migration adds restrictive policies so role permission is enforced
-- even if someone bypasses the UI.

begin;

create or replace function public.normalize_agency_role(raw_role text)
returns text
language sql
stable
as $$
  select case lower(trim(coalesce(raw_role, '')))
    when 'owner' then 'owner'
    when 'admin' then 'owner'
    when 'manager' then 'manager'
    when 'accountant' then 'accountant'
    else 'agent'
  end;
$$;

create or replace function public.can_role_access(permission text)
returns boolean
language sql
stable
as $$
  with me as (
    select
      is_super_admin,
      public.normalize_agency_role(role) as role_norm
    from public.users_profiles
    where id = auth.uid()
    limit 1
  )
  select case
    when coalesce((select is_super_admin from me), false) then true
    when permission = 'dashboard' then true
    when (select role_norm from me) = 'owner' then true
    when (select role_norm from me) = 'manager' and permission in ('vehicles', 'clients', 'reservations', 'payments') then true
    when (select role_norm from me) = 'agent' and permission in ('clients', 'reservations') then true
    when (select role_norm from me) = 'accountant' and permission in ('payments', 'reports') then true
    else false
  end;
$$;

-- Vehicles
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehicles'
      and policyname = 'role_gate_vehicles_restrictive'
  ) then
    execute '
      create policy role_gate_vehicles_restrictive
      on public.vehicles
      as restrictive
      for all
      to authenticated
      using (public.can_role_access(''vehicles''))
      with check (public.can_role_access(''vehicles''))';
  end if;
end $$;

-- Clients
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clients'
      and policyname = 'role_gate_clients_restrictive'
  ) then
    execute '
      create policy role_gate_clients_restrictive
      on public.clients
      as restrictive
      for all
      to authenticated
      using (public.can_role_access(''clients''))
      with check (public.can_role_access(''clients''))';
  end if;
end $$;

-- Reservations
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reservations'
      and policyname = 'role_gate_reservations_restrictive'
  ) then
    execute '
      create policy role_gate_reservations_restrictive
      on public.reservations
      as restrictive
      for all
      to authenticated
      using (public.can_role_access(''reservations''))
      with check (public.can_role_access(''reservations''))';
  end if;
end $$;

-- Contracts
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'contracts'
      and policyname = 'role_gate_contracts_restrictive'
  ) then
    execute '
      create policy role_gate_contracts_restrictive
      on public.contracts
      as restrictive
      for all
      to authenticated
      using (public.can_role_access(''contracts''))
      with check (public.can_role_access(''contracts''))';
  end if;
end $$;

-- Payments
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'role_gate_payments_restrictive'
  ) then
    execute '
      create policy role_gate_payments_restrictive
      on public.payments
      as restrictive
      for all
      to authenticated
      using (public.can_role_access(''payments''))
      with check (public.can_role_access(''payments''))';
  end if;
end $$;

-- Maintenance
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'maintenance'
      and policyname = 'role_gate_maintenance_restrictive'
  ) then
    execute '
      create policy role_gate_maintenance_restrictive
      on public.maintenance
      as restrictive
      for all
      to authenticated
      using (public.can_role_access(''maintenance''))
      with check (public.can_role_access(''maintenance''))';
  end if;
end $$;

commit;
