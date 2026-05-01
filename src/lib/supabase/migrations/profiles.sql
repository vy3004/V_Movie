create table public.profiles (
  id uuid not null,
  email text null,
  full_name text null,
  avatar_url text null,
  role text null default 'user'::text,
  created_at timestamp with time zone null default now(),
  notification_settings jsonb null default '{"web_push": false, "new_episode": true, "watch_party": true, "comment_reply": true}'::jsonb,
  bio text null,
  last_ai_recommendation_at timestamp with time zone null,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_profiles_last_ai_recommendation_at on public.profiles using btree (last_ai_recommendation_at) TABLESPACE pg_default;