create table if not exists public.deleted_access_accounts (
  id uuid primary key default gen_random_uuid(),
  original_agency_id uuid not null,
  agency_name text not null,
  owner_name text,
  email text,
  phone text,
  plan text,
  billing_status text,
  account_status text,
  monthly_price numeric(12,2) default 0,
  annual_price numeric(12,2) default 0,
  billing_type text,
  users_count int default 0,
  vehicles_count int default 0,
  payment_method text,
  payment_notes text,
  original_created_at timestamptz,
  deleted_at timestamptz not null default now()
);

alter table public.deleted_access_accounts enable row level security;

drop policy if exists "Super admin can read deleted access accounts" on public.deleted_access_accounts;
create policy "Super admin can read deleted access accounts"
on public.deleted_access_accounts for select
to authenticated
using (public.is_super_admin());

drop policy if exists "Super admin can insert deleted access accounts" on public.deleted_access_accounts;
create policy "Super admin can insert deleted access accounts"
on public.deleted_access_accounts for insert
to authenticated
with check (public.is_super_admin());
