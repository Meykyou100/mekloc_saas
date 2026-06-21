alter table public.access_requests
  add column if not exists requested_vehicle_count int,
  add column if not exists requested_user_count int,
  add column if not exists plan_price numeric(12,2),
  add column if not exists plan_duration text,
  add column if not exists plan_vehicle_limit int,
  add column if not exists plan_user_limit int;
