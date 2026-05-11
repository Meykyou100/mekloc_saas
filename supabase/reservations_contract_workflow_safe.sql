-- Safe migration for Reservation -> Contract workflow enrichment
-- Non-destructive: only adds nullable columns / indexes / safe checks.

alter table public.reservations add column if not exists pickup_location text;
alter table public.reservations add column if not exists return_location text;
alter table public.reservations add column if not exists total_amount numeric(12,2);
alter table public.reservations add column if not exists deposit_amount numeric(12,2);
alter table public.reservations add column if not exists mileage_out integer;
alter table public.reservations add column if not exists fuel_level_out text;

-- keep backward compatibility with existing "deposit" column
update public.reservations
set deposit_amount = deposit
where deposit_amount is null and deposit is not null;

-- status expansion to include pending without breaking existing values
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_status_check_v2'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations
      add constraint reservations_status_check_v2
      check (status in ('pending','Confirmed','Active','Completed','Cancelled'))
      not valid;
  end if;
end $$;

create index if not exists idx_reservations_vehicle_dates
  on public.reservations (agency_id, vehicle_id, pickup_date, return_date);
