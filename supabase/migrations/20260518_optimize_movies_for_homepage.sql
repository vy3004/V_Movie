alter table public.movies
  add column if not exists episode_state text not null default 'unknown',
  add column if not exists season integer,
  add column if not exists source_vote_average numeric(3,1),
  add column if not exists source_vote_count integer not null default 0,
  add column if not exists vote_average numeric(3,1),
  add column if not exists vote_count integer not null default 0,
  add column if not exists popularity_score double precision not null default 0;

create index if not exists movies_last_synced_at_idx on public.movies(last_synced_at desc);
create index if not exists movies_type_last_synced_at_idx on public.movies(type, last_synced_at desc);
create index if not exists movies_popularity_score_idx on public.movies(popularity_score desc);
create index if not exists movies_vote_rank_idx on public.movies(vote_count desc, vote_average desc);
