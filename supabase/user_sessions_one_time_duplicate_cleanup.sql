-- MekLoc - One-time cleanup for old duplicate user session/device rows
-- Safe scope: public.user_sessions only. Does not touch auth.users, agencies, or profiles.
--
-- Keeps the latest row per:
--   user_id + device_id + device_name + browser + os
-- Older duplicates are marked disconnected via revoked_at when available.
-- If a future/alternate schema uses status instead, older duplicates are marked disconnected.
-- If neither revoked_at nor status exists, older duplicates are deleted from user_sessions only.

do $$
declare
  has_revoked_at boolean;
  has_status boolean;
  has_device_id boolean;
  has_last_activity_at boolean;
  has_last_seen_at boolean;
  has_created_at boolean;
  has_first_seen_at boolean;
  partition_device_expr text;
  order_expr text;
begin
  if to_regclass('public.user_sessions') is null then
    raise notice 'public.user_sessions does not exist. Cleanup skipped.';
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_sessions' and column_name = 'revoked_at'
  ) into has_revoked_at;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_sessions' and column_name = 'status'
  ) into has_status;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_sessions' and column_name = 'device_id'
  ) into has_device_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_sessions' and column_name = 'last_activity_at'
  ) into has_last_activity_at;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_sessions' and column_name = 'last_seen_at'
  ) into has_last_seen_at;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_sessions' and column_name = 'created_at'
  ) into has_created_at;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_sessions' and column_name = 'first_seen_at'
  ) into has_first_seen_at;

  partition_device_expr := case
    when has_device_id then 'coalesce(device_id, '''')'
    else ''''''
  end;

  order_expr := 'coalesce('
    || case when has_last_activity_at then 'last_activity_at, ' else '' end
    || case when has_last_seen_at then 'last_seen_at, ' else '' end
    || case when has_created_at then 'created_at, ' else '' end
    || case when has_first_seen_at then 'first_seen_at, ' else '' end
    || 'now()) desc, id desc';

  if has_revoked_at then
    execute format($sql$
      with ranked as (
        select
          id,
          row_number() over (
            partition by user_id, %s, coalesce(device_name, ''), coalesce(browser, ''), coalesce(os, '')
            order by %s
          ) as rn
        from public.user_sessions
        where revoked_at is null
      )
      update public.user_sessions us
      set revoked_at = now()
      from ranked r
      where us.id = r.id
        and r.rn > 1
        and us.revoked_at is null;
    $sql$, partition_device_expr, order_expr);

    raise notice 'Duplicate active sessions marked as disconnected using revoked_at.';
    return;
  end if;

  if has_status then
    execute format($sql$
      with ranked as (
        select
          id,
          row_number() over (
            partition by user_id, %s, coalesce(device_name, ''), coalesce(browser, ''), coalesce(os, '')
            order by %s
          ) as rn
        from public.user_sessions
        where coalesce(status, 'active') not in ('disconnected', 'revoked', 'deleted')
      )
      update public.user_sessions us
      set status = 'disconnected'
      from ranked r
      where us.id = r.id
        and r.rn > 1;
    $sql$, partition_device_expr, order_expr);

    raise notice 'Duplicate active sessions marked as disconnected using status.';
    return;
  end if;

  execute format($sql$
    with ranked as (
      select
        id,
        row_number() over (
          partition by user_id, %s, coalesce(device_name, ''), coalesce(browser, ''), coalesce(os, '')
          order by %s
        ) as rn
      from public.user_sessions
    )
    delete from public.user_sessions us
    using ranked r
    where us.id = r.id
      and r.rn > 1;
  $sql$, partition_device_expr, order_expr);

  raise notice 'Duplicate sessions deleted from public.user_sessions because no disconnect column exists.';
end $$;
