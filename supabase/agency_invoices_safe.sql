-- MekLoc agency subscription invoices.
-- Safe to run repeatedly in Supabase SQL Editor.

begin;

create table if not exists public.agency_invoices (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  invoice_number text not null,
  plan_id text not null,
  plan_name text not null,
  billing_period text not null,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'MAD',
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  invoice_date date not null default current_date,
  due_date date,
  sent_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, invoice_number)
);

create index if not exists agency_invoices_agency_date_idx
  on public.agency_invoices(agency_id, invoice_date desc);

create or replace function public.set_agency_invoices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_agency_invoices_updated_at on public.agency_invoices;
create trigger set_agency_invoices_updated_at
before update on public.agency_invoices
for each row execute function public.set_agency_invoices_updated_at();

alter table public.agency_invoices enable row level security;

drop policy if exists agency_invoices_select on public.agency_invoices;
create policy agency_invoices_select
  on public.agency_invoices for select to authenticated
  using (public.can_access_agency_data(agency_id));

drop policy if exists agency_invoices_insert_super_admin on public.agency_invoices;
create policy agency_invoices_insert_super_admin
  on public.agency_invoices for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists agency_invoices_update_super_admin on public.agency_invoices;
create policy agency_invoices_update_super_admin
  on public.agency_invoices for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists agency_invoices_delete_super_admin on public.agency_invoices;
create policy agency_invoices_delete_super_admin
  on public.agency_invoices for delete to authenticated
  using (public.is_super_admin());

commit;
