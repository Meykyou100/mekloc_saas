create or replace function public.is_deleted_account(target_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.deleted_access_accounts
    where lower(email) = lower(target_email)
  );
$$;

grant execute on function public.is_deleted_account(text) to authenticated, anon;
