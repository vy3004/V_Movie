create unique index if not exists watch_party_playlist_unique_item
  on public.watch_party_playlist (room_id, movie_slug, episode_slug);
