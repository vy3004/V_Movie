create table public.campaign_stats (
  id uuid not null default gen_random_uuid (),
  campaign_name text not null,
  target_slug text null,
  total_targeted integer null default 0,
  successful_deliveries integer null default 0,
  failed_deliveries integer null default 0,
  click_count integer null default 0,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint campaign_stats_pkey primary key (id)
) TABLESPACE pg_default;