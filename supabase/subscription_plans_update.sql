alter table public.agencies add column if not exists billing_type text not null default 'monthly' check (billing_type in ('monthly', 'annual', 'lifetime'));
alter table public.agencies add column if not exists annual_price numeric(12, 2) not null default 0;

alter table public.agencies alter column plan drop default;
alter table public.agencies alter column plan set default 'starter';

do $$
begin
  begin
    alter table public.agencies drop constraint if exists agencies_plan_check;
  exception when undefined_object then null;
  end;
  alter table public.agencies
    add constraint agencies_plan_check check (plan in ('starter', 'pro', 'business', 'lifetime'));
end $$;

update public.agencies set plan = 'starter' where plan = 'free';
update public.agencies set monthly_price = 99 where plan = 'starter' and coalesce(monthly_price, 0) = 0;
update public.agencies set monthly_price = 250 where plan = 'pro' and coalesce(monthly_price, 0) < 250;
update public.agencies set annual_price = 2500 where plan = 'pro' and coalesce(annual_price, 0) = 0;
update public.agencies set annual_price = 4990 where plan = 'business' and coalesce(annual_price, 0) = 0;
update public.agencies set monthly_price = 5999 where plan = 'lifetime' and coalesce(monthly_price, 0) = 0;
update public.agencies set annual_price = 5999 where plan = 'lifetime' and coalesce(annual_price, 0) = 0;
