-- MekLoc access workflow hardening

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  agency_name text not null,
  owner_name text not null,
  email text not null,
  phone_country_code text default '+212',
  phone_number text not null,
  country text default 'Maroc',
  city text not null,
  address text,
  vehicle_count int default 0,
  selected_plan text default 'starter',
  billing_type text default 'monthly',
  status text default 'pending',
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists access_requests_email_unique_idx
on public.access_requests (lower(email));

alter table public.access_requests enable row level security;

drop policy if exists "public insert access requests" on public.access_requests;
create policy "public insert access requests"
on public.access_requests for insert
to anon, authenticated
with check (true);

drop policy if exists "super admin read access requests" on public.access_requests;
create policy "super admin read access requests"
on public.access_requests for select
to authenticated
using (exists (select 1 from public.users_profiles up where up.id = auth.uid() and up.is_super_admin = true));

drop policy if exists "super admin update access requests" on public.access_requests;
create policy "super admin update access requests"
on public.access_requests for update
to authenticated
using (exists (select 1 from public.users_profiles up where up.id = auth.uid() and up.is_super_admin = true))
with check (exists (select 1 from public.users_profiles up where up.id = auth.uid() and up.is_super_admin = true));

drop policy if exists "super admin delete access requests" on public.access_requests;
create policy "super admin delete access requests"
on public.access_requests for delete
to authenticated
using (exists (select 1 from public.users_profiles up where up.id = auth.uid() and up.is_super_admin = true));
