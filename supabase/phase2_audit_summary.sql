-- Phase 2 Audit Summary (read-only, consolidated, schema-aware)
-- Output columns:
--   category | check_name | status | issue_count | recommendation
--
-- No writes, no deletes, no schema changes.

drop table if exists pg_temp.audit_summary;
create temporary table audit_summary (
  category text,
  check_name text,
  status text,
  issue_count bigint,
  recommendation text
);

do $$
declare
  has_col boolean;
  has_table boolean;
  cnt bigint;
begin
  -- -------------------------
  -- SCHEMA checks
  -- -------------------------
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='contracts' and column_name='reservation_id'
  ) into has_col;
  insert into audit_summary values (
    'schema',
    'contracts.reservation_id',
    case when has_col then 'ok' else 'missing' end,
    case when has_col then 0 else 1 end,
    case when has_col then 'Aucune action.' else 'Ajouter la colonne et relation vers reservations quand le modèle sera prêt.' end
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='payments' and column_name='reservation_id'
  ) into has_col;
  insert into audit_summary values (
    'schema',
    'payments.reservation_id',
    case when has_col then 'ok' else 'missing' end,
    case when has_col then 0 else 1 end,
    case when has_col then 'Aucune action.' else 'Ajouter la colonne si les paiements doivent pointer vers réservation.' end
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='payments' and column_name='invoice_id'
  ) into has_col;
  insert into audit_summary values (
    'schema',
    'payments.invoice_id',
    case when has_col then 'ok' else 'missing' end,
    case when has_col then 0 else 1 end,
    case when has_col then 'Aucune action.' else 'Ajouter invoice_id si la facturation par facture est activée.' end
  );

  select exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='maintenance_records'
  ) into has_table;
  if has_table then
    select exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='maintenance_records' and column_name='vehicle_id'
    ) into has_col;
    insert into audit_summary values (
      'schema',
      'maintenance_records.vehicle_id',
      case when has_col then 'ok' else 'missing' end,
      case when has_col then 0 else 1 end,
      case when has_col then 'Aucune action.' else 'Ajouter vehicle_id pour lier les entretiens au parc.' end
    );
  else
    insert into audit_summary values (
      'schema',
      'maintenance_records table',
      'missing',
      1,
      'Créer la table maintenance_records si elle est prévue dans l’architecture cible.'
    );
  end if;

  -- -------------------------
  -- MISSING_AGENCY checks
  -- -------------------------
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='vehicles' and column_name='agency_id'
  ) into has_col;
  if has_col then
    execute 'select count(*) from public.vehicles where agency_id is null' into cnt;
    insert into audit_summary values (
      'missing_agency',
      'vehicles sans agency_id',
      case when cnt = 0 then 'ok' else 'issues_found' end,
      cnt,
      case when cnt = 0 then 'Aucune action.' else 'Rattacher chaque véhicule à une agence.' end
    );
  else
    insert into audit_summary values (
      'missing_agency',
      'vehicles.agency_id',
      'missing',
      1,
      'Ajouter la colonne agency_id pour isolation multi-agence.'
    );
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='clients' and column_name='agency_id'
  ) into has_col;
  if has_col then
    execute 'select count(*) from public.clients where agency_id is null' into cnt;
    insert into audit_summary values (
      'missing_agency',
      'clients sans agency_id',
      case when cnt = 0 then 'ok' else 'issues_found' end,
      cnt,
      case when cnt = 0 then 'Aucune action.' else 'Rattacher chaque client à une agence.' end
    );
  else
    insert into audit_summary values (
      'missing_agency',
      'clients.agency_id',
      'missing',
      1,
      'Ajouter la colonne agency_id pour isolation multi-agence.'
    );
  end if;

  -- -------------------------
  -- DUPLICATES checks
  -- -------------------------
  execute $q$
    select coalesce(sum(x.cnt - 1), 0)
    from (
      select lower(trim(email)) as normalized_email, count(*) as cnt
      from public.access_requests
      where email is not null and trim(email) <> ''
      group by lower(trim(email))
      having count(*) > 1
    ) x
  $q$ into cnt;
  insert into audit_summary values (
    'duplicates',
    'emails dupliqués dans access_requests',
    case when cnt = 0 then 'ok' else 'issues_found' end,
    cnt,
    case when cnt = 0 then 'Aucune action.' else 'Conserver une demande canonique par email et archiver les doublons.' end
  );

  -- -------------------------
  -- INVALID_STATUSES checks
  -- -------------------------
  execute $q$
    select count(*) from public.reservations
    where status is null or status not in ('Confirmed', 'Active', 'Completed', 'Cancelled')
  $q$ into cnt;
  insert into audit_summary values (
    'invalid_statuses',
    'reservations.status invalide',
    case when cnt = 0 then 'ok' else 'issues_found' end,
    cnt,
    case when cnt = 0 then 'Aucune action.' else 'Normaliser les statuts réservation vers la liste autorisée.' end
  );

  execute $q$
    select count(*) from public.payments
    where status is null or status not in ('Paid', 'Partial', 'Pending', 'Late')
  $q$ into cnt;
  insert into audit_summary values (
    'invalid_statuses',
    'payments.status invalide',
    case when cnt = 0 then 'ok' else 'issues_found' end,
    cnt,
    case when cnt = 0 then 'Aucune action.' else 'Normaliser les statuts paiement vers la liste autorisée.' end
  );

  execute $q$
    select count(*) from public.access_requests
    where status is null or status not in ('pending', 'pending_verification', 'contacted', 'payment_pending', 'approved', 'rejected', 'verified')
  $q$ into cnt;
  insert into audit_summary values (
    'invalid_statuses',
    'access_requests.status invalide',
    case when cnt = 0 then 'ok' else 'issues_found' end,
    cnt,
    case when cnt = 0 then 'Aucune action.' else 'Aligner les statuts de demande d’accès sur le workflow officiel.' end
  );

  execute $q$
    select count(*) from public.users_profiles
    where account_status is null or account_status not in ('pending', 'active', 'rejected', 'suspended')
  $q$ into cnt;
  insert into audit_summary values (
    'invalid_statuses',
    'users_profiles.account_status invalide',
    case when cnt = 0 then 'ok' else 'issues_found' end,
    cnt,
    case when cnt = 0 then 'Aucune action.' else 'Corriger account_status selon le cycle de vie compte.' end
  );

  execute $q$
    select count(*) from public.agencies
    where billing_status is null or billing_status not in ('trial', 'paid', 'unpaid', 'overdue', 'cancelled')
  $q$ into cnt;
  insert into audit_summary values (
    'invalid_statuses',
    'agencies.billing_status invalide',
    case when cnt = 0 then 'ok' else 'issues_found' end,
    cnt,
    case when cnt = 0 then 'Aucune action.' else 'Uniformiser billing_status selon les valeurs supportées.' end
  );

  -- -------------------------
  -- ORPHAN_RECORDS checks
  -- -------------------------
  execute $q$
    select count(*)
    from public.reservations r
    left join public.agencies a on a.id = r.agency_id
    left join public.clients c on c.id = r.client_id
    left join public.vehicles v on v.id = r.vehicle_id
    where a.id is null or c.id is null or v.id is null
  $q$ into cnt;
  insert into audit_summary values (
    'orphan_records',
    'reservations orphelines',
    case when cnt = 0 then 'ok' else 'issues_found' end,
    cnt,
    case when cnt = 0 then 'Aucune action.' else 'Réparer les références agence/client/véhicule manquantes.' end
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='payments' and column_name='reservation_id'
  ) into has_col;
  if has_col then
    execute $q$
      select count(*)
      from public.payments p
      left join public.agencies a on a.id = p.agency_id
      left join public.clients c on c.id = p.client_id
      left join public.reservations r on r.id = p.reservation_id
      where a.id is null
         or c.id is null
         or (p.reservation_id is not null and r.id is null)
    $q$ into cnt;
    insert into audit_summary values (
      'orphan_records',
      'payments orphelins',
      case when cnt = 0 then 'ok' else 'issues_found' end,
      cnt,
      case when cnt = 0 then 'Aucune action.' else 'Corriger les liens paiements -> agence/client/réservation.' end
    );
  else
    execute $q$
      select count(*)
      from public.payments p
      left join public.agencies a on a.id = p.agency_id
      left join public.clients c on c.id = p.client_id
      where a.id is null or c.id is null
    $q$ into cnt;
    insert into audit_summary values (
      'orphan_records',
      'payments orphelins (sans reservation_id)',
      case when cnt = 0 then 'warning_missing_column' else 'issues_found' end,
      cnt,
      'payments.reservation_id manquant - relation réservation non auditée.'
    );
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='contracts' and column_name='reservation_id'
  ) into has_col;
  if has_col then
    execute $q$
      select count(*)
      from public.contracts ct
      left join public.agencies a on a.id = ct.agency_id
      left join public.clients c on c.id = ct.client_id
      left join public.vehicles v on v.id = ct.vehicle_id
      left join public.reservations r on r.id = ct.reservation_id
      where a.id is null
         or c.id is null
         or v.id is null
         or (ct.reservation_id is not null and r.id is null)
    $q$ into cnt;
    insert into audit_summary values (
      'orphan_records',
      'contracts orphelins',
      case when cnt = 0 then 'ok' else 'issues_found' end,
      cnt,
      case when cnt = 0 then 'Aucune action.' else 'Corriger les liens contrat -> agence/client/véhicule/réservation.' end
    );
  else
    execute $q$
      select count(*)
      from public.contracts ct
      left join public.agencies a on a.id = ct.agency_id
      left join public.clients c on c.id = ct.client_id
      left join public.vehicles v on v.id = ct.vehicle_id
      where a.id is null or c.id is null or v.id is null
    $q$ into cnt;
    insert into audit_summary values (
      'orphan_records',
      'contracts orphelins (sans reservation_id)',
      case when cnt = 0 then 'warning_missing_column' else 'issues_found' end,
      cnt,
      'contracts.reservation_id manquant - relation réservation non auditée.'
    );
  end if;

  -- -------------------------
  -- RELATIONSHIPS checks (FK presence)
  -- -------------------------
  execute $q$
    with expected_fk as (
      select 'reservations'::text as table_name, 'agency_id'::text as column_name, 'agencies'::text as ref_table union all
      select 'reservations', 'client_id', 'clients' union all
      select 'reservations', 'vehicle_id', 'vehicles' union all
      select 'contracts', 'agency_id', 'agencies' union all
      select 'contracts', 'client_id', 'clients' union all
      select 'contracts', 'vehicle_id', 'vehicles' union all
      select 'contracts', 'reservation_id', 'reservations' union all
      select 'payments', 'agency_id', 'agencies' union all
      select 'payments', 'client_id', 'clients' union all
      select 'payments', 'reservation_id', 'reservations' union all
      select 'payments', 'invoice_id', 'invoices' union all
      select 'maintenance_records', 'agency_id', 'agencies' union all
      select 'maintenance_records', 'vehicle_id', 'vehicles' union all
      select 'users_profiles', 'agency_id', 'agencies' union all
      select 'vehicles', 'agency_id', 'agencies' union all
      select 'clients', 'agency_id', 'agencies'
    ),
    existing_columns as (
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
    ),
    actual_fk as (
      select tc.table_name, kcu.column_name, ccu.table_name as ref_table
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on tc.constraint_name = ccu.constraint_name
       and tc.table_schema = ccu.table_schema
      where tc.table_schema = 'public'
        and tc.constraint_type = 'FOREIGN KEY'
    )
    select count(*)
    from expected_fk e
    join existing_columns ec
      on ec.table_name = e.table_name
     and ec.column_name = e.column_name
    left join actual_fk a
      on a.table_name = e.table_name
     and a.column_name = e.column_name
     and a.ref_table = e.ref_table
    where a.table_name is null
  $q$ into cnt;
  insert into audit_summary values (
    'relationships',
    'foreign keys manquantes (colonnes existantes)',
    case when cnt = 0 then 'ok' else 'issues_found' end,
    cnt,
    case when cnt = 0 then 'Aucune action.' else 'Ajouter les FK manquantes sur les colonnes déjà présentes.' end
  );

  -- -------------------------
  -- SECURITY checks (RLS enabled)
  -- -------------------------
  execute $q$
    select count(*)
    from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename in (
        'agencies','users_profiles','vehicles','clients',
        'reservations','contracts','payments','access_requests'
      )
      and rowsecurity = false
  $q$ into cnt;
  insert into audit_summary values (
    'security',
    'RLS désactivée sur tables sensibles',
    case when cnt = 0 then 'ok' else 'issues_found' end,
    cnt,
    case when cnt = 0 then 'Aucune action.' else 'Activer RLS sur toutes les tables sensibles avant mise en production.' end
  );
end $$;

select
  category,
  check_name,
  status,
  issue_count,
  recommendation
from audit_summary
order by
  case category
    when 'schema' then 1
    when 'relationships' then 2
    when 'duplicates' then 3
    when 'invalid_statuses' then 4
    when 'missing_agency' then 5
    when 'orphan_records' then 6
    when 'security' then 7
    else 99
  end,
  check_name;
