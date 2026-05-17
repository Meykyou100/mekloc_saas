-- MekLoc - Safe team management controls
-- Non-destructive: adds helper functions, restrictive RLS, and a trigger
-- to keep role/status changes limited to agency team managers.

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

do $$
begin
  alter table public.users_profiles drop constraint if exists users_profiles_role_check;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_profiles_role_check'
      and conrelid = 'public.users_profiles'::regclass
  ) then
    alter table public.users_profiles
      add constraint users_profiles_role_check
      check (lower(trim(role)) in ('owner', 'admin', 'manager', 'agent', 'staff', 'accountant'))
      not valid;
  end if;
end $$;

create or replace function public.can_manage_agency_team(target_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_super_admin(), false)
    or exists (
      select 1
      from public.users_profiles up
      where up.id = auth.uid()
        and up.account_status = 'active'
        and up.agency_id = target_agency_id
        and public.normalize_agency_role(up.role) in ('owner', 'manager')
    );
$$;

drop policy if exists "Team profile updates require manager" on public.users_profiles;
create policy "Team profile updates require manager"
on public.users_profiles
as restrictive
for update
to authenticated
using (
  public.is_super_admin()
  or id = auth.uid()
  or public.can_manage_agency_team(agency_id)
)
with check (
  public.is_super_admin()
  or id = auth.uid()
  or public.can_manage_agency_team(agency_id)
);

create or replace function public.protect_users_profiles_team_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_role text;
  old_role text;
  new_role text;
  sensitive_changed boolean;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if coalesce(auth.role(), '') = 'service_role' or public.is_super_admin() then
    return new;
  end if;

  sensitive_changed :=
    new.role is distinct from old.role
    or new.account_status is distinct from old.account_status
    or new.agency_id is distinct from old.agency_id
    or new.is_super_admin is distinct from old.is_super_admin;

  if not sensitive_changed then
    return new;
  end if;

  if old.id = auth.uid() then
    raise exception 'Votre propre rôle ou statut doit être modifié par un autre propriétaire.';
  end if;

  if not public.can_manage_agency_team(old.agency_id) then
    raise exception 'Accès refusé pour gérer cette équipe.';
  end if;

  select public.normalize_agency_role(role)
    into acting_role
  from public.users_profiles
  where id = auth.uid()
  limit 1;

  old_role := public.normalize_agency_role(old.role);
  new_role := public.normalize_agency_role(new.role);

  if acting_role <> 'owner' and (old_role = 'owner' or new_role = 'owner') then
    raise exception 'Seul un propriétaire peut gérer un propriétaire.';
  end if;

  if new.agency_id is distinct from old.agency_id then
    raise exception 'Le changement d’agence est réservé au service admin.';
  end if;

  if new.is_super_admin is distinct from old.is_super_admin then
    raise exception 'Le statut super admin est réservé au service admin.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_users_profiles_team_fields on public.users_profiles;
create trigger protect_users_profiles_team_fields
before update on public.users_profiles
for each row
execute function public.protect_users_profiles_team_fields();

do $$
begin
  if to_regclass('public.user_sessions') is not null then
    execute 'drop policy if exists "Team managers can revoke agency sessions" on public.user_sessions';
    execute 'create policy "Team managers can revoke agency sessions"
      on public.user_sessions
      for update
      to authenticated
      using (public.can_manage_agency_team(agency_id))
      with check (public.can_manage_agency_team(agency_id))';
  end if;
end $$;

commit;
