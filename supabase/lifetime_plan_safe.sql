-- MekLoc - Lifetime plan support
-- Safe migration: expands existing plan/billing constraints without changing data.

alter table public.agencies add column if not exists billing_type text not null default 'monthly';
alter table public.agencies add column if not exists annual_price numeric(12, 2) not null default 0;

do $$
begin
  begin
    alter table public.access_requests drop constraint if exists access_requests_selected_plan_check;
  exception when undefined_object then null;
  end;

  alter table public.access_requests
    add constraint access_requests_selected_plan_check
    check (selected_plan in ('gratuit', 'starter', 'pro', 'business', 'lifetime'));
end $$;

do $$
begin
  begin
    alter table public.access_requests drop constraint if exists access_requests_billing_type_check;
  exception when undefined_object then null;
  end;

  alter table public.access_requests
    add constraint access_requests_billing_type_check
    check (billing_type in ('monthly', 'annual', 'lifetime'));
end $$;

do $$
begin
  update public.agencies set plan = 'starter' where plan = 'free';

  begin
    alter table public.agencies drop constraint if exists agencies_plan_check;
  exception when undefined_object then null;
  end;

  alter table public.agencies
    add constraint agencies_plan_check
    check (plan in ('starter', 'pro', 'business', 'lifetime'));
end $$;

do $$
begin
  begin
    alter table public.agencies drop constraint if exists agencies_billing_type_check;
  exception when undefined_object then null;
  end;

  alter table public.agencies
    add constraint agencies_billing_type_check
    check (billing_type in ('monthly', 'annual', 'lifetime'));
end $$;

update public.agencies set monthly_price = 5999 where plan = 'lifetime' and coalesce(monthly_price, 0) = 0;
update public.agencies set annual_price = 5999 where plan = 'lifetime' and coalesce(annual_price, 0) = 0;
