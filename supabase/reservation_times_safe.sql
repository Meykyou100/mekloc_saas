alter table public.reservations add column if not exists start_time text;
alter table public.reservations add column if not exists end_time text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reservations_start_time_format'
  ) then
    alter table public.reservations
      add constraint reservations_start_time_format
      check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'reservations_end_time_format'
  ) then
    alter table public.reservations
      add constraint reservations_end_time_format
      check (end_time is null or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;
end $$;
