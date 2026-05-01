create table public.notifications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  type text not null,
  movie_slug text null,
  movie_name text null,
  actor_name text null,
  content text not null,
  is_read boolean null default false,
  metadata jsonb null,
  created_at timestamp with time zone null default now(),
  constraint notifications_pkey primary key (id),
  constraint notifications_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_notifications_user_unread on public.notifications using btree (user_id) TABLESPACE pg_default
where
  (is_read = false);