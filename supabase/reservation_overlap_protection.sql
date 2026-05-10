-- ==========================================================
-- MekLoc - Reservation overlap protection (safe migration)
-- ==========================================================
-- Purpose:
-- - Prevent double-booking of the same vehicle in the same agency.
-- - Validate overlap on INSERT and UPDATE.
-- - Keep backward compatibility (no destructive change).
--
-- Notes:
-- - Overlap blocking applies to reservations with status:
--   'Confirmed' or 'Active'.
-- - 'Cancelled' and 'Completed' reservations do not block new bookings.
-- - This migration does not delete or alter existing data.

-- Performance index for overlap checks
create index if not exists idx_reservations_overlap_lookup
  on public.reservations (agency_id, vehicle_id, status, pickup_date, return_date);

-- Trigger function: block overlapping active/confirmed reservations
create or replace function public.prevent_reservation_overlap()
returns trigger
language plpgsql
as $$
begin
  -- Guard only for statuses that block the calendar
  if new.status not in ('Confirmed', 'Active') then
    return new;
  end if;

  if exists (
    select 1
    from public.reservations r
    where r.agency_id = new.agency_id
      and r.vehicle_id = new.vehicle_id
      and r.status in ('Confirmed', 'Active')
      and r.id <> new.id
      and r.pickup_date <= new.return_date
      and r.return_date >= new.pickup_date
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'overlap_reservation',
      detail = 'Ce véhicule est déjà réservé sur cette période.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_reservation_overlap on public.reservations;
create trigger trg_prevent_reservation_overlap
before insert or update of agency_id, vehicle_id, pickup_date, return_date, status
on public.reservations
for each row
execute function public.prevent_reservation_overlap();
