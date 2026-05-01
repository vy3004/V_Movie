create table public.watch_party_playlist (
  id uuid not null default gen_random_uuid (),
  room_id uuid not null,
  movie_slug text not null,
  movie_name text not null,
  episode_slug text not null,
  thumb_url text null,
  sort_order integer not null default 0,
  added_by uuid null,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint watch_party_playlist_pkey primary key (id),
  constraint watch_party_playlist_added_by_fkey foreign KEY (added_by) references profiles (id) on delete CASCADE,
  constraint watch_party_playlist_room_id_fkey foreign KEY (room_id) references watch_party_rooms (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_wp_playlist_room on public.watch_party_playlist using btree (room_id, sort_order) TABLESPACE pg_default;