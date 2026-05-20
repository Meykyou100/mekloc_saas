create extension if not exists pgcrypto;

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agency_id uuid references public.agencies(id) on delete cascade,
  device_name text,
  device_label text,
  browser text,
  os text,
  user_agent text,
  session_key text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
);

alter table public.user_sessions
  add column if not exists agency_id uuid references public.agencies(id) on delete cascade;

alter table public.user_sessions
  add column if not exists device_name text;

alter table public.user_sessions
  add column if not exists device_label text;

alter table public.user_sessions
  add column if not exists browser text;

alter table public.user_sessions
  add column if not exists os text;

alter table public.user_sessions
  add column if not exists user_agent text;

alter table public.user_sessions
  add column if not exists session_key text;

alter table public.user_sessions
  add column if not exists first_seen_at timestamptz not null default now();

alter table public.user_sessions
  add column if not exists last_seen_at timestamptz not null default now();

alter table public.user_sessions
  add column if not exists created_at timestamptz not null default now();

alter table public.user_sessions
  add column if not exists revoked_at timestamptz null;

alter table public.user_sessions
  add column if not exists location text;

alter table public.user_sessions
  add column if not exists location_city text;

alter table public.user_sessions
  add column if not exists location_country text;

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

drop policy if exists "Own session rows can be updated" on public.user_sessions;
create policy "Own session rows can be updated"
on public.user_sessions for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
