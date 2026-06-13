-- Minimal CRM metadata storage for access requests.
-- Agency CRM metadata uses the existing agencies.settings jsonb column.

alter table public.access_requests
  add column if not exists crm_metadata jsonb not null default '{}'::jsonb;

comment on column public.access_requests.crm_metadata is
  'Super Admin CRM metadata: pipeline_status, follow_up_date, internal_notes, health_score, last_contact_at.';
