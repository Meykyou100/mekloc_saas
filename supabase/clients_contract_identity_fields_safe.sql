-- MekLoc - Optional client identity fields required by rental contracts.
-- Non-destructive and multi-agency safe: fields remain on the existing
-- agency-scoped clients table and no RLS or authorization policy is changed.

alter table if exists public.clients
  add column if not exists birth_date date;

alter table if exists public.clients
  add column if not exists birth_place text;

alter table if exists public.clients
  add column if not exists nationality text;

alter table if exists public.clients
  add column if not exists driving_license_issued_at date;

alter table if exists public.clients
  add column if not exists driving_license_issued_place text;

alter table if exists public.clients
  add column if not exists driving_license_expires_at date;

alter table if exists public.clients
  add column if not exists identity_document_issued_at date;

comment on column public.clients.birth_date is
'Client date of birth used on rental contracts.';

comment on column public.clients.birth_place is
'Client place of birth used on rental contracts.';

comment on column public.clients.nationality is
'Client nationality used on rental contracts.';

comment on column public.clients.driving_license_issued_at is
'Driving licence issue date used on rental contracts.';

comment on column public.clients.driving_license_issued_place is
'Driving licence issue place used on rental contracts.';

comment on column public.clients.driving_license_expires_at is
'Driving licence expiry date.';

comment on column public.clients.identity_document_issued_at is
'CIN or passport issue date used on rental contracts.';
