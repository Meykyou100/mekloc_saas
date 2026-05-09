create or replace function public.get_access_request_status(target_email text)
returns table (
  email text,
  agency_name text,
  selected_plan text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ar.email, ar.agency_name, ar.selected_plan, ar.status, ar.created_at
  from public.access_requests ar
  where lower(ar.email) = lower(target_email)
  order by ar.created_at desc
  limit 1;
$$;

grant execute on function public.get_access_request_status(text) to anon, authenticated;
