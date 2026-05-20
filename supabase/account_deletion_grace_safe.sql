alter table public.users_profiles
  add column if not exists deletion_requested_at timestamptz null;

alter table public.users_profiles
  add column if not exists deletion_scheduled_at timestamptz null;

do $$
begin
  alter table public.users_profiles
    drop constraint if exists users_profiles_account_status_check;

  alter table public.users_profiles
    add constraint users_profiles_account_status_check
    check (account_status in ('pending', 'active', 'rejected', 'suspended', 'pending_deletion'))
    not valid;
exception
  when duplicate_object then null;
end $$;
