create table if not exists public.deleted_access_requests (
  id uuid primary key default gen_random_uuid(),
  original_request_id uuid not null,
  agency_name text not null,
  owner_name text not null,
  email text not null,
  phone_country_code text not null,
  phone_number text not null,
  city text not null,
  selected_plan text not null,
  billing_type text not null,
  vehicle_count int not null default 0,
  status text not null,
  admin_notes text,
  original_created_at timestamptz,
  deleted_at timestamptz not null default now()
);

alter table public.deleted_access_requests enable row level security;

drop policy if exists "Super admin can read deleted access requests" on public.deleted_access_requests;
create policy "Super admin can read deleted access requests"
on public.deleted_access_requests for select
to authenticated
using (public.is_super_admin());

drop policy if exists "Super admin can insert deleted access requests" on public.deleted_access_requests;
create policy "Super admin can insert deleted access requests"
on public.deleted_access_requests for insert
to authenticated
with check (public.is_super_admin());
