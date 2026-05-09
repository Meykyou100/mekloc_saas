create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  agency_name text not null,
  owner_name text not null,
  address text not null,
  country text not null default 'Maroc',
  city text not null,
  website_url text,
  email text not null,
  phone_country_code text not null default '+212',
  phone_number text not null,
  vehicle_count int not null default 0,
  selected_plan text not null check (selected_plan in ('gratuit', 'starter', 'business')),
  billing_type text not null check (billing_type in ('monthly', 'annual')),
  monthly_price numeric(12,2) not null default 0,
  annual_price numeric(12,2) not null default 0,
  promo_code text,
  status text not null default 'pending' check (status in ('pending','contacted','payment_pending','approved','rejected')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_access_requests_updated_at on public.access_requests;
create trigger set_access_requests_updated_at before update on public.access_requests
for each row execute function public.set_updated_at();

alter table public.access_requests enable row level security;

drop policy if exists "Public can insert access requests" on public.access_requests;
create policy "Public can insert access requests"
on public.access_requests for insert
to anon, authenticated
with check (true);

drop policy if exists "Super admin can read access requests" on public.access_requests;
create policy "Super admin can read access requests"
on public.access_requests for select
to authenticated
using (public.is_super_admin());

drop policy if exists "Super admin can update access requests" on public.access_requests;
create policy "Super admin can update access requests"
on public.access_requests for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());
