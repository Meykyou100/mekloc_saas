alter table public.maintenance
  add column if not exists details jsonb not null default '{}'::jsonb;
