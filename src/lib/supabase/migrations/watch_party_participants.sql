create table public.watch_party_participants (
  id uuid not null default gen_random_uuid (),
  room_id uuid not null,
  user_id uuid not null,
  role text null default 'guest'::text,
  status text null default 'pending'::text,
  permissions jsonb null default '{"can_manage_users": false, "can_control_media": false}'::jsonb,
  is_muted boolean null default false,
  joined_at timestamp with time zone not null default timezone ('utc'::text, now()),
  is_voice_muted boolean null default false,
  constraint watch_party_participants_pkey primary key (id),
  constraint watch_party_participants_room_id_user_id_key unique (room_id, user_id),
  constraint watch_party_participants_room_id_fkey foreign KEY (room_id) references watch_party_rooms (id) on delete CASCADE,
  constraint watch_party_participants_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE,
  constraint watch_party_participants_role_check check ((role = any (array['host'::text, 'guest'::text]))),
  constraint watch_party_participants_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'approved'::text,
          'blocked'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_wp_participants_room_user on public.watch_party_participants using btree (room_id, user_id) TABLESPACE pg_default;

create trigger tr_delete_empty_room
after DELETE on watch_party_participants for EACH row
execute FUNCTION delete_empty_room ();

create trigger trigger_participant_sync
after INSERT
or DELETE on watch_party_participants for EACH row
execute FUNCTION handle_participant_sync ();

create trigger trigger_sync_host_id
after
update OF role on watch_party_participants for EACH row when (new.role = 'host'::text)
execute FUNCTION handle_host_update ();

create trigger trigger_update_participant_count
after INSERT
or DELETE on watch_party_participants for EACH row
execute FUNCTION update_participant_count ();