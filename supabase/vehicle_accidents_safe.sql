-- MekLoc accident dossiers. Apply after the base schema and role_permissions_rls_safe.sql.
create table if not exists public.vehicle_accidents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  responsible_user_id uuid references public.users_profiles(id) on delete set null,
  accident_number text not null,
  accident_date timestamptz not null,
  accident_location text,
  accident_city text,
  accident_type text not null,
  severity text not null default 'medium',
  description text,
  vehicle_status_after text not null default 'immobilized',
  has_third_party boolean not null default false,
  third_party_name text, third_party_phone text, third_party_vehicle text, third_party_plate text, third_party_insurance text,
  driver_name text, driver_phone text, driver_license text,
  insurance_company text, insurance_policy_number text, declaration_number text, expert_name text, garage_name text, garage_phone text,
  estimated_repair_cost numeric not null default 0, final_repair_cost numeric not null default 0, franchise_amount numeric not null default 0,
  insurance_refund_amount numeric not null default 0, client_charge_amount numeric not null default 0, agency_charge_amount numeric not null default 0,
  immobilization_start date, immobilization_end date,
  status text not null default 'open', priority text not null default 'normal', notes text,
  created_by uuid references public.users_profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (agency_id, accident_number),
  check (accident_type in ('collision','rayure','bris_glace','panne_accident','vol','incendie','autre')),
  check (severity in ('minor','medium','serious')),
  check (vehicle_status_after in ('disponible','immobilized','garage','expertise','repaired','total_loss')),
  check (status in ('open','declared','expertise','repair_in_progress','waiting_payment','closed','rejected')),
  check (priority in ('low','normal','urgent'))
);

create table if not exists public.accident_documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  accident_id uuid not null references public.vehicle_accidents(id) on delete cascade,
  document_type text not null, file_name text, file_url text not null, storage_path text, mime_type text, size_bytes bigint,
  uploaded_by uuid references public.users_profiles(id) on delete set null, created_at timestamptz not null default now()
);

create index if not exists vehicle_accidents_agency_idx on public.vehicle_accidents(agency_id);
create index if not exists vehicle_accidents_vehicle_idx on public.vehicle_accidents(vehicle_id);
create index if not exists vehicle_accidents_reservation_idx on public.vehicle_accidents(reservation_id);
create index if not exists vehicle_accidents_client_idx on public.vehicle_accidents(client_id);
create index if not exists vehicle_accidents_status_idx on public.vehicle_accidents(status);
create index if not exists vehicle_accidents_date_idx on public.vehicle_accidents(accident_date desc);
create index if not exists accident_documents_agency_idx on public.accident_documents(agency_id);
create index if not exists accident_documents_accident_idx on public.accident_documents(accident_id);

alter table public.vehicle_accidents enable row level security;
alter table public.accident_documents enable row level security;

-- Same-agency data access. Existing role policies may be added later for stricter write roles.
drop policy if exists "agency members manage vehicle accidents" on public.vehicle_accidents;
create policy "agency members manage vehicle accidents" on public.vehicle_accidents for all
  using (agency_id = public.current_user_agency_id())
  with check (agency_id = public.current_user_agency_id());
drop policy if exists "agency members manage accident documents" on public.accident_documents;
create policy "agency members manage accident documents" on public.accident_documents for all
  using (agency_id = public.current_user_agency_id())
  with check (agency_id = public.current_user_agency_id());

insert into storage.buckets (id, name, public) values ('accident-documents', 'accident-documents', false) on conflict (id) do nothing;
drop policy if exists "agency accident document access" on storage.objects;
create policy "agency accident document access" on storage.objects for all to authenticated
  using (bucket_id = 'accident-documents' and (storage.foldername(name))[1] = public.current_user_agency_id()::text)
  with check (bucket_id = 'accident-documents' and (storage.foldername(name))[1] = public.current_user_agency_id()::text);
