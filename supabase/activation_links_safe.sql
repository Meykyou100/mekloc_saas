create table if not exists public.activation_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  email text not null,
  agency_id uuid references public.agencies(id) on delete cascade,
  role text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists activation_links_token_idx
on public.activation_links(token);

create index if not exists activation_links_email_idx
on public.activation_links(lower(email));

alter table public.activation_links enable row level security;

drop policy if exists "Activation links are service-role only" on public.activation_links;
create policy "Activation links are service-role only"
on public.activation_links
as restrictive
for all
using (false)
with check (false);
