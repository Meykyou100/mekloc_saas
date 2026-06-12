-- MekLoc 7-day trial lifecycle.
-- Safe to run more than once in the Supabase SQL editor.

alter table public.agencies add column if not exists subscription_status text;
alter table public.agencies add column if not exists trial_started_at timestamptz;
alter table public.agencies add column if not exists trial_ends_at timestamptz;
alter table public.agencies add column if not exists paid_until timestamptz;
alter table public.agencies add column if not exists last_trial_email_sent_at timestamptz;
alter table public.agencies add column if not exists trial_expired_notified_at timestamptz;
alter table public.agencies add column if not exists trial_reminder_3d_sent_at timestamptz;
alter table public.agencies add column if not exists trial_reminder_1d_sent_at timestamptz;
alter table public.agencies add column if not exists trial_expired_email_sent_at timestamptz;
alter table public.agencies add column if not exists last_trial_extended_at timestamptz;

alter table public.agencies drop constraint if exists agencies_payment_method_check;
alter table public.agencies
  add constraint agencies_payment_method_check
  check (payment_method in ('cash', 'bank_transfer', 'card', 'cih', 'paypal', 'other')) not valid;

update public.agencies
set subscription_status = case billing_status
  when 'paid' then 'active_paid'
  when 'trial' then 'trial_active'
  when 'overdue' then 'trial_expired'
  when 'cancelled' then 'suspended'
  else 'payment_pending'
end
where subscription_status is null;

update public.agencies
set trial_started_at = coalesce(subscription_start_date::timestamptz, created_at, now()),
    trial_ends_at = coalesce(
      subscription_end_date::timestamptz,
      subscription_start_date::timestamptz + interval '7 days',
      created_at + interval '7 days'
    )
where subscription_status = 'trial_active'
  and trial_started_at is null;

update public.agencies
set paid_until = coalesce(
  subscription_end_date::timestamptz,
  next_payment_due_date::timestamptz
)
where subscription_status = 'active_paid'
  and paid_until is null;

alter table public.agencies
  alter column subscription_status set default 'payment_pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agencies_subscription_status_check'
  ) then
    alter table public.agencies
      add constraint agencies_subscription_status_check
      check (subscription_status in (
        'trial_active',
        'trial_expired',
        'active_paid',
        'payment_pending',
        'suspended'
      )) not valid;
  end if;
end $$;

create index if not exists agencies_subscription_status_idx
  on public.agencies(subscription_status);
create index if not exists agencies_trial_ends_at_idx
  on public.agencies(trial_ends_at);
create index if not exists agencies_paid_until_idx
  on public.agencies(paid_until);

create or replace function public.can_access_agency_data(target_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users_profiles profiles
    join public.agencies agencies on agencies.id = profiles.agency_id
    where profiles.id = auth.uid()
      and profiles.agency_id = target_agency_id
      and profiles.account_status = 'active'
      and (
        profiles.is_super_admin = true
        or (
          coalesce(agencies.subscription_status,
            case agencies.billing_status
              when 'paid' then 'active_paid'
              when 'trial' then 'trial_active'
              when 'cancelled' then 'suspended'
              else 'payment_pending'
            end
          ) = 'active_paid'
          and (agencies.paid_until is null or agencies.paid_until >= now())
        )
        or (
          coalesce(agencies.subscription_status,
            case agencies.billing_status when 'trial' then 'trial_active' else 'payment_pending' end
          ) in ('trial_active', 'trial_expired')
          and (
            agencies.trial_ends_at is null
            or agencies.trial_ends_at + interval '24 hours' >= now()
          )
        )
      )
  );
$$;

grant execute on function public.can_access_agency_data(uuid) to authenticated;
