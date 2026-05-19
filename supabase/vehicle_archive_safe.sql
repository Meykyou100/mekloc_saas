alter table public.vehicles
  add column if not exists archived_at timestamptz;

create index if not exists vehicles_archived_at_idx
  on public.vehicles(archived_at);
