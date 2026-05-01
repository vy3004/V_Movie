create table public.movie_check_queue (
  movie_slug text not null,
  created_at timestamp with time zone null default now(),
  constraint movie_check_queue_pkey primary key (movie_slug)
) TABLESPACE pg_default;

create index IF not exists idx_queue_created_at on public.movie_check_queue using btree (created_at) TABLESPACE pg_default;