-- MekLoc - Vehicle condition fields (safe, non-destructive)
-- Adds optional fields for contract damage/accessories rendering.

alter table public.vehicles
  add column if not exists vehicle_color text;

alter table public.vehicles
  add column if not exists accessories jsonb default '{}'::jsonb;

alter table public.vehicles
  add column if not exists damage_marks jsonb default '[]'::jsonb;

