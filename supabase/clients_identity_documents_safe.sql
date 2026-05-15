-- MekLoc - Safe migration for client identity document URLs
-- Non-destructive: only adds optional columns if they don't exist yet.

alter table if exists public.clients
  add column if not exists id_card_front_url text;

alter table if exists public.clients
  add column if not exists id_card_back_url text;

comment on column public.clients.id_card_front_url is
'Public or signed URL of client identity front image (CIN/Passport recto).';

comment on column public.clients.id_card_back_url is
'Public or signed URL of client identity back image (CIN/Passport verso).';
