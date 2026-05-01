create table public.comment_likes (
  user_id uuid not null,
  comment_id uuid not null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint comment_likes_pkey primary key (user_id, comment_id),
  constraint comment_likes_comment_id_fkey foreign KEY (comment_id) references comments (id) on delete CASCADE,
  constraint comment_likes_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger trigger_update_likes_count
after INSERT
or DELETE on comment_likes for EACH row
execute FUNCTION handle_comment_likes_count ();