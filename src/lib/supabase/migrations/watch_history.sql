create table public.watch_history (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid null,
  device_id character varying(255) null,
  movie_slug character varying(255) not null,
  movie_name character varying(255) not null,
  movie_poster text null,
  last_episode_slug character varying(255) not null,
  episodes_progress jsonb null default '{}'::jsonb,
  is_finished boolean null default false,
  updated_at timestamp with time zone null default now(),
  created_at timestamp with time zone null default now(),
  last_episode_of_movie_slug text null,
  constraint watch_history_pkey primary key (id),
  constraint unique_history unique NULLS not distinct (user_id, device_id, movie_slug),
  constraint watch_history_user_movie_unique unique (user_id, movie_slug),
  constraint watch_history_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_history_user on public.watch_history using btree (user_id, updated_at desc) TABLESPACE pg_default;

create index IF not exists idx_history_device on public.watch_history using btree (device_id, updated_at desc) TABLESPACE pg_default;

create index IF not exists idx_history_movie_slug on public.watch_history using btree (movie_slug) TABLESPACE pg_default;