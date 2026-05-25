-- MekLoc - Safe device/session deduplication
-- Keeps one active row per user + device_id and marks old duplicated browser/device rows as revoked.

alter table public.user_sessions
  add column if not exists device_id text;

alter table public.user_sessions
  add column if not exists device_type text;

alter table public.user_sessions
  add column if not exists last_activity_at timestamptz;

alter table public.user_sessions
  add column if not exists ip text;

update public.user_sessions
set last_activity_at = coalesce(last_activity_at, last_seen_at, created_at, now())
where last_activity_at is null;

create index if not exists user_sessions_device_id_idx
on public.user_sessions(device_id)
where device_id is not null;

-- Existing rows did not have a stable device_id. Keep the latest active row for each
-- user/agency/device/browser/os signature and revoke older active duplicates.
with ranked as (
  select
    id,
    row_number() over (
      partition by
        user_id,
        agency_id,
        coalesce(device_name, ''),
        coalesce(browser, ''),
        coalesce(os, '')
      order by coalesce(last_seen_at, created_at, first_seen_at, now()) desc, created_at desc, id desc
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

-- New rows use a stable browser/device identifier stored client-side.
create unique index if not exists user_sessions_user_device_uidx
on public.user_sessions(user_id, device_id)
where device_id is not null;
