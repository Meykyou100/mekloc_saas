begin;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null,
  cover_image_url text,
  category text,
  tags text[] not null default '{}',
  author_name text not null default 'MekLoc',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  reading_time_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_status_published_idx on public.blog_posts (status, published_at desc);
create index if not exists blog_posts_slug_idx on public.blog_posts (slug);

create or replace function public.set_blog_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_blog_posts_updated_at on public.blog_posts;
create trigger set_blog_posts_updated_at
before update on public.blog_posts
for each row
execute function public.set_blog_posts_updated_at();

alter table public.blog_posts enable row level security;

drop policy if exists "Public can read published blog posts" on public.blog_posts;
create policy "Public can read published blog posts"
on public.blog_posts
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Super admins can read all blog posts" on public.blog_posts;
create policy "Super admins can read all blog posts"
on public.blog_posts
for select
to authenticated
using (public.is_super_admin());

drop policy if exists "Super admins can create blog posts" on public.blog_posts;
create policy "Super admins can create blog posts"
on public.blog_posts
for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists "Super admins can update blog posts" on public.blog_posts;
create policy "Super admins can update blog posts"
on public.blog_posts
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Super admins can delete blog posts" on public.blog_posts;
create policy "Super admins can delete blog posts"
on public.blog_posts
for delete
to authenticated
using (public.is_super_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-covers',
  'blog-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Public can read blog covers" on storage.objects;
create policy "Public can read blog covers"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'blog-covers');

drop policy if exists "Super admins can upload blog covers" on storage.objects;
create policy "Super admins can upload blog covers"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'blog-covers' and public.is_super_admin());

drop policy if exists "Super admins can update blog covers" on storage.objects;
create policy "Super admins can update blog covers"
on storage.objects
for update
to authenticated
using (bucket_id = 'blog-covers' and public.is_super_admin())
with check (bucket_id = 'blog-covers' and public.is_super_admin());

drop policy if exists "Super admins can delete blog covers" on storage.objects;
create policy "Super admins can delete blog covers"
on storage.objects
for delete
to authenticated
using (bucket_id = 'blog-covers' and public.is_super_admin());

commit;
