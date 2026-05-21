create extension if not exists pgcrypto;

create table if not exists public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  verified_at timestamptz null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists email_verifications_email_idx on public.email_verifications(lower(email));
create index if not exists email_verifications_expires_at_idx on public.email_verifications(expires_at);
create index if not exists email_verifications_created_at_idx on public.email_verifications(created_at);

alter table public.email_verifications enable row level security;

alter table public.access_requests
  add column if not exists email_verified boolean not null default false;

alter table public.access_requests
  add column if not exists email_verified_at timestamptz null;
