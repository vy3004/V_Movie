create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  origin_name text,
  normalized_name text not null,
  normalized_origin_name text,
  search_text text not null,
  dedupe_key text not null,
  year integer,
  type text,
  status text,
  thumb_url text,
  poster_url text,
  episode_current text,
  episode_number integer default 0,
  quality text,
  lang text,
  category_slugs text[] default '{}',
  country_slugs text[] default '{}',
  sources jsonb not null default '[]'::jsonb,
  primary_source text,
  primary_source_slug text,
  merge_status text not null default 'merged',
  content_hash text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_queue (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  confidence_score numeric not null default 0,
  reason text not null,
  candidate_sources jsonb not null,
  target_movie_id uuid references public.movies(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

create table if not exists public.merge_history (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  movie_id uuid references public.movies(id) on delete set null,
  review_id uuid references public.review_queue(id) on delete set null,
  before jsonb not null,
  after jsonb not null,
  admin_user_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.movie_index_state (
  source text primary key,
  mode text not null default 'backfill',
  backfill_page integer not null default 1,
  backfill_done boolean not null default false,
  last_incremental_page integer not null default 1,
  last_seen_modified_at timestamptz,
  paused boolean not null default false,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create table if not exists public.movie_index_jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  mode text not null,
  page_start integer not null,
  page_end integer not null,
  status text not null default 'queued',
  retry_count integer not null default 0,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  created_by text not null default 'cron',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.movie_index_state (source)
values ('ophim'), ('phimapi'), ('nguonc')
on conflict (source) do nothing;

create index if not exists movies_type_idx on public.movies(type);
create index if not exists movies_year_idx on public.movies(year);
create index if not exists movies_dedupe_key_idx on public.movies(dedupe_key);
create index if not exists movies_episode_number_idx on public.movies(episode_number desc);
create index if not exists movies_updated_at_idx on public.movies(updated_at desc);
create index if not exists movies_category_slugs_gin_idx on public.movies using gin (category_slugs);
create index if not exists movies_country_slugs_gin_idx on public.movies using gin (country_slugs);
create index if not exists movies_search_text_trgm_idx on public.movies using gin (search_text gin_trgm_ops);
create index if not exists movies_normalized_name_trgm_idx on public.movies using gin (normalized_name gin_trgm_ops);
create index if not exists movies_normalized_origin_name_trgm_idx on public.movies using gin (normalized_origin_name gin_trgm_ops);
create index if not exists review_queue_status_idx on public.review_queue(status, created_at desc);
create index if not exists movie_index_jobs_status_idx on public.movie_index_jobs(status, created_at);

alter table public.movies enable row level security;
alter table public.review_queue enable row level security;
alter table public.merge_history enable row level security;
alter table public.movie_index_state enable row level security;
alter table public.movie_index_jobs enable row level security;
