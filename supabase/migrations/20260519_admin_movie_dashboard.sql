alter table movies
add column if not exists is_blocked boolean not null default false;

create index if not exists movies_visible_updated_idx
on movies (last_synced_at desc)
where is_blocked = false;

create index if not exists movies_visible_popularity_idx
on movies (popularity_score desc nulls last)
where is_blocked = false;

create table if not exists movie_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists movie_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references movie_collections(id) on delete cascade,
  movie_id uuid not null references movies(id) on delete cascade,
  slug text not null,
  label text not null,
  item_type text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, movie_id)
);

create index if not exists movie_collection_items_movie_id_idx
on movie_collection_items (movie_id);

create index if not exists movie_collection_items_collection_sort_idx
on movie_collection_items (collection_id, sort_order asc);
