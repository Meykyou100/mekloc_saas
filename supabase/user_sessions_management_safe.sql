-- MekLoc - Safe session/user activity management
-- Non-destructive migration for session tracking + activity timestamps

create extension if not exists pgcrypto;

alter table public.users_profiles
  add column if not exists last_login_at timestamptz;

alter table public.users_profiles
  add column if not exists last_seen_at timestamptz;

alter table public.users_profiles
  add column if not exists disabled_at timestamptz;

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  device_name text,
  browser text,
  os text,
  user_agent text,
  session_key text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_sessions_user_id_idx on public.user_sessions(user_id);
create index if not exists user_sessions_agency_id_idx on public.user_sessions(agency_id);
create index if not exists user_sessions_last_seen_at_idx on public.user_sessions(last_seen_at);
create index if not exists user_sessions_revoked_at_idx on public.user_sessions(revoked_at);
create unique index if not exists user_sessions_session_key_uidx on public.user_sessions(session_key) where session_key is not null;

alter table public.user_sessions enable row level security;

drop policy if exists "Own sessions are readable" on public.user_sessions;
create policy "Own sessions are readable"
on public.user_sessions for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Super admin can read all sessions" on public.user_sessions;
create policy "Super admin can read all sessions"
on public.user_sessions for select
to authenticated
using (public.is_super_admin());

drop policy if exists "Own session rows can be inserted" on public.user_sessions;
create policy "Own session rows can be inserted"
on public.user_sessions for insert
to authenticated
with check (user_id = auth.uid() and public.can_access_agency_data(agency_id));

drop policy if exists "Own session rows can be updated" on public.user_sessions;
create policy "Own session rows can be updated"
on public.user_sessions for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Super admin can revoke sessions" on public.user_sessions;
create policy "Super admin can revoke sessions"
on public.user_sessions for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());
