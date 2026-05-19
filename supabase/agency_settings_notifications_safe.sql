alter table public.agencies
  add column if not exists settings jsonb not null default '{}'::jsonb;
