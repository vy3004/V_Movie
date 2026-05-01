create table public.comments (
  id uuid not null default gen_random_uuid (),
  movie_slug text not null,
  user_id uuid not null,
  parent_id uuid null,
  reply_to_id uuid null,
  content text not null,
  likes_count integer null default 0,
  replies_count integer null default 0,
  is_edited boolean null default false,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone null default timezone ('utc'::text, now()),
  path text[] null default '{}'::text[],
  constraint comments_pkey primary key (id),
  constraint comments_parent_id_fkey foreign KEY (parent_id) references comments (id) on delete CASCADE,
  constraint comments_reply_to_id_fkey foreign KEY (reply_to_id) references comments (id) on delete set null,
  constraint comments_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint comments_user_id_fkey_profiles foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_comments_movie_slug on public.comments using btree (movie_slug, created_at desc) TABLESPACE pg_default;

create index IF not exists idx_comments_parent_id on public.comments using btree (parent_id) TABLESPACE pg_default;

create index IF not exists idx_comments_path on public.comments using gin (path) TABLESPACE pg_default;

create trigger trigger_handle_replies_count
after INSERT
or DELETE on comments for EACH row
execute FUNCTION handle_replies_count ();

create trigger trigger_update_comments_updated_at BEFORE
update on comments for EACH row
execute FUNCTION update_updated_at_column ();