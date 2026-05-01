create table public.user_subscriptions (
  user_id uuid not null,
  movie_slug text not null,
  movie_name text not null,
  movie_poster text null,
  last_known_episode_slug text null,
  has_new_episode boolean null default false,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone null default timezone ('utc'::text, now()),
  movie_status text null default 'ongoing'::text,
  constraint user_subscriptions_pkey primary key (user_id, movie_slug),
  constraint user_subscriptions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_subs_status_slug on public.user_subscriptions using btree (movie_status, last_known_episode_slug) TABLESPACE pg_default;

create trigger update_user_subscriptions_updated_at BEFORE
update on user_subscriptions for EACH row
execute FUNCTION update_updated_at_column ();