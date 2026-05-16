-- Safe migration for MekLoc agency branding settings.
-- Non-destructive: adds missing columns only.

alter table public.agencies
  add column if not exists logo_url text;

alter table public.agencies
  add column if not exists ice text;

alter table public.agencies
  add column if not exists rc text;

