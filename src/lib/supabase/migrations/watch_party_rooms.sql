create table public.watch_party_rooms (
  id uuid not null default gen_random_uuid (),
  room_code text not null,
  host_id uuid not null,
  current_movie_slug text null,
  current_episode_slug text null,
  movie_image text null,
  title text null default 'Phòng xem phim vui vẻ'::text,
  is_private boolean null default false,
  max_participants integer null default 20,
  is_active boolean null default true,
  settings jsonb null default '{"wait_for_all": false, "guest_can_chat": true, "allow_guest_control": false}'::jsonb,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  last_active_at timestamp with time zone null default timezone ('utc'::text, now()),
  participant_count integer null default 0,
  constraint watch_party_rooms_pkey primary key (id),
  constraint watch_party_rooms_room_code_key unique (room_code),
  constraint watch_party_rooms_host_id_fkey foreign KEY (host_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_wp_rooms_code on public.watch_party_rooms using btree (room_code) TABLESPACE pg_default;