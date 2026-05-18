-- MekLoc - harden payments reservation linking.
-- Safe to run multiple times. Keeps payment rows attached by reservation_id, then derives vehicle/client links from that reservation.

alter table public.payments
  add column if not exists vehicle_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_vehicle_id_fkey'
  ) then
    alter table public.payments
      add constraint payments_vehicle_id_fkey
      foreign key (vehicle_id) references public.vehicles(id) on delete set null not valid;
  end if;
end $$;

create index if not exists payments_reservation_id_idx on public.payments(reservation_id);
create index if not exists payments_vehicle_id_idx on public.payments(vehicle_id);
create index if not exists payments_agency_reservation_idx on public.payments(agency_id, reservation_id);

update public.payments p
set reservation_id = r.id
from public.reservations r
where p.reservation_id is null
  and p.agency_id = r.agency_id
  and p.invoice = 'INV-' || r.reservation_number;

update public.payments p
set
  client_id = r.client_id,
  vehicle_id = r.vehicle_id
from public.reservations r
where p.reservation_id = r.id
  and p.agency_id = r.agency_id
  and (p.client_id is distinct from r.client_id or p.vehicle_id is distinct from r.vehicle_id);
