alter table public.watch_party_participants
  add column if not exists updated_at timestamptz not null default now();

alter table public.watch_party_participants
  add column if not exists realtime_revision bigint not null default 0;

create or replace function public.bump_watch_party_participant_realtime_revision()
returns trigger
language plpgsql
as $$
begin
  new.realtime_revision := coalesce(old.realtime_revision, 0) + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bump_watch_party_participant_realtime_revision on public.watch_party_participants;

create trigger bump_watch_party_participant_realtime_revision
before update on public.watch_party_participants
for each row
execute function public.bump_watch_party_participant_realtime_revision();

alter table public.watch_party_participants replica identity full;
