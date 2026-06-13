-- MekLoc support mode / impersonation.
-- Safe to run repeatedly in the Supabase SQL editor.

begin;

create table if not exists public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  super_admin_user_id uuid not null references auth.users(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz not null,
  mode text not null check (mode in ('read_only', 'full_access')),
  reason text not null check (char_length(trim(reason)) >= 5),
  created_at timestamptz not null default now(),
  check (expires_at > started_at),
  check (expires_at <= started_at + interval '30 minutes')
);

create index if not exists support_sessions_admin_active_idx
  on public.support_sessions(super_admin_user_id, expires_at)
  where ended_at is null;
create index if not exists support_sessions_agency_idx
  on public.support_sessions(agency_id, started_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  agency_id uuid references public.agencies(id) on delete cascade,
  support_session_id uuid references public.support_sessions(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_support_session_idx
  on public.audit_logs(support_session_id, created_at desc);
create index if not exists audit_logs_agency_idx
  on public.audit_logs(agency_id, created_at desc);

alter table public.support_sessions enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists support_sessions_super_admin_select on public.support_sessions;
create policy support_sessions_super_admin_select
  on public.support_sessions for select to authenticated
  using (public.is_super_admin() and super_admin_user_id = auth.uid());

drop policy if exists support_sessions_super_admin_insert on public.support_sessions;
create policy support_sessions_super_admin_insert
  on public.support_sessions for insert to authenticated
  with check (
    public.is_super_admin()
    and super_admin_user_id = auth.uid()
    and expires_at <= now() + interval '30 minutes'
  );

drop policy if exists support_sessions_super_admin_update on public.support_sessions;
create policy support_sessions_super_admin_update
  on public.support_sessions for update to authenticated
  using (public.is_super_admin() and super_admin_user_id = auth.uid())
  with check (public.is_super_admin() and super_admin_user_id = auth.uid());

drop policy if exists audit_logs_super_admin_select on public.audit_logs;
create policy audit_logs_super_admin_select
  on public.audit_logs for select to authenticated
  using (public.is_super_admin());

create or replace function public.active_support_session(target_agency_id uuid)
returns public.support_sessions
language sql
stable
security definer
set search_path = public
as $$
  select ss
  from public.support_sessions ss
  where ss.super_admin_user_id = auth.uid()
    and ss.agency_id = target_agency_id
    and ss.ended_at is null
    and ss.expires_at > now()
  order by ss.started_at desc
  limit 1;
$$;

create or replace function public.enforce_and_audit_support_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_agency uuid;
  support_session public.support_sessions;
  record_id text;
begin
  if not public.is_super_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  target_agency := coalesce(
    case when tg_op <> 'DELETE' then new.agency_id else null end,
    case when tg_op <> 'INSERT' then old.agency_id else null end
  );
  select * into support_session from public.active_support_session(target_agency);

  if support_session.id is null then
    raise exception 'support_session_required';
  end if;
  if support_session.mode = 'read_only' then
    raise exception 'support_session_read_only';
  end if;

  record_id := coalesce(
    case when tg_op <> 'DELETE' then to_jsonb(new)->>'id' else null end,
    case when tg_op <> 'INSERT' then to_jsonb(old)->>'id' else null end
  );
  insert into public.audit_logs (
    actor_user_id, agency_id, support_session_id, action, entity_type, entity_id, metadata
  ) values (
    auth.uid(), target_agency, support_session.id, lower(tg_op), tg_table_name, record_id,
    jsonb_build_object('support_mode', support_session.mode)
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['vehicles','clients','reservations','contracts','payments','maintenance']
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists audit_support_write on public.%I', table_name);
      execute format(
        'create trigger audit_support_write before insert or update or delete on public.%I for each row execute function public.enforce_and_audit_support_write()',
        table_name
      );
    end if;
  end loop;
end $$;

create or replace function public.audit_support_agency_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  support_session public.support_sessions;
begin
  if not public.is_super_admin() then return new; end if;
  select * into support_session from public.active_support_session(new.id);
  if support_session.id is null then return new; end if;
  if support_session.mode = 'read_only' then
    raise exception 'support_session_read_only';
  end if;
  insert into public.audit_logs(actor_user_id, agency_id, support_session_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), new.id, support_session.id, 'update', 'agencies', new.id::text, jsonb_build_object('support_mode', support_session.mode));
  return new;
end;
$$;

drop trigger if exists audit_support_agency_update on public.agencies;
create trigger audit_support_agency_update
before update on public.agencies
for each row execute function public.audit_support_agency_update();

create or replace function public.audit_support_session_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs(actor_user_id, agency_id, support_session_id, action, entity_type, entity_id, metadata)
    values (new.super_admin_user_id, new.agency_id, new.id, 'support_session_started', 'support_session', new.id::text, jsonb_build_object('mode', new.mode, 'reason', new.reason));
  elsif old.ended_at is null and new.ended_at is not null then
    insert into public.audit_logs(actor_user_id, agency_id, support_session_id, action, entity_type, entity_id, metadata)
    values (new.super_admin_user_id, new.agency_id, new.id, 'support_session_ended', 'support_session', new.id::text, jsonb_build_object('mode', new.mode));
  end if;
  return new;
end;
$$;

drop trigger if exists audit_support_session_lifecycle on public.support_sessions;
create trigger audit_support_session_lifecycle
after insert or update on public.support_sessions
for each row execute function public.audit_support_session_lifecycle();

commit;
