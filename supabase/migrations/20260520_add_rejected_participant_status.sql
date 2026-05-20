alter table public.watch_party_participants
  drop constraint if exists watch_party_participants_status_check;

alter table public.watch_party_participants
  add constraint watch_party_participants_status_check
  check (status = any (array['pending'::text, 'approved'::text, 'blocked'::text, 'rejected'::text]));
