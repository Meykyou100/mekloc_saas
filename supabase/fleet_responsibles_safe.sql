-- MekLoc - Gestion des responsables de flotte (Phase 1)
-- Safe to run more than once. Apply in Supabase SQL Editor.

begin;

alter table public.vehicles
  add column if not exists responsible_user_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vehicles_responsible_user_id_fkey'
  ) then
    alter table public.vehicles
      add constraint vehicles_responsible_user_id_fkey
      foreign key (responsible_user_id)
      references public.users_profiles(id)
      on delete set null;
  end if;
end $$;

create index if not exists vehicles_agency_responsible_user_idx
  on public.vehicles (agency_id, responsible_user_id)
  where responsible_user_id is not null;

create or replace function public.validate_vehicle_responsible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text;
  requester_is_super_admin boolean;
  responsible_changed boolean;
begin
  select
    coalesce(is_super_admin, false),
    lower(trim(coalesce(role, 'agent')))
  into requester_is_super_admin, requester_role
  from public.users_profiles
  where id = auth.uid();

  responsible_changed := tg_op = 'INSERT'
    or new.responsible_user_id is distinct from old.responsible_user_id;

  if responsible_changed
     and not coalesce(requester_is_super_admin, false)
     and coalesce(requester_role, 'agent') not in ('owner', 'admin') then
    raise exception 'Only agency owners can assign a fleet responsible.';
  end if;

  if new.responsible_user_id is not null and not exists (
    select 1
    from public.users_profiles profile
    where profile.id = new.responsible_user_id
      and profile.agency_id = new.agency_id
      and profile.account_status = 'active'
  ) then
    raise exception 'The selected fleet responsible must be an active user from the same agency.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_vehicle_responsible on public.vehicles;
create trigger validate_vehicle_responsible
before insert or update of agency_id, responsible_user_id on public.vehicles
for each row
execute function public.validate_vehicle_responsible();

commit;
