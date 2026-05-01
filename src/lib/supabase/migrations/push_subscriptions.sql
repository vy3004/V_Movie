create table public.push_subscriptions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  subscription jsonb not null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint push_subscriptions_pkey primary key (id),
  constraint push_subscriptions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;