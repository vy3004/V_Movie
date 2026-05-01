create table public.user_recommendations (
  user_id uuid not null,
  recommendations jsonb null default '[]'::jsonb,
  updated_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint user_recommendations_pkey primary key (user_id),
  constraint user_recommendations_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_recommendations_updated_at on public.user_recommendations using btree (updated_at desc) TABLESPACE pg_default;

create trigger update_user_recommendations_updated_at BEFORE
update on user_recommendations for EACH row
execute FUNCTION update_updated_at_column ();