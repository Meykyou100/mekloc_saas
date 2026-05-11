-- Safe production hardening migration: branding + contract relation
-- Non-destructive only.

-- Agency branding URL cache (optional, logo_path remains source of truth)
alter table public.agencies add column if not exists logo_url text;

-- Safe contract -> reservation linkage if missing
alter table public.contracts add column if not exists reservation_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema='public'
      and table_name='contracts'
      and constraint_name='contracts_reservation_id_fkey'
  ) then
    alter table public.contracts
      add constraint contracts_reservation_id_fkey
      foreign key (reservation_id) references public.reservations(id) on delete set null not valid;
  end if;
end $$;

create index if not exists idx_contracts_reservation_id on public.contracts(reservation_id);
