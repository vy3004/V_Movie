create or replace function public.search_movies(
  search_keyword text,
  page_number integer default 1,
  page_size integer default 24
)
returns table (
  id uuid,
  slug text,
  name text,
  origin_name text,
  year integer,
  type text,
  thumb_url text,
  poster_url text,
  episode_current text,
  episode_number integer,
  episode_state text,
  season integer,
  quality text,
  lang text,
  category_slugs text[],
  country_slugs text[],
  vote_average numeric,
  vote_count integer,
  popularity_score double precision,
  primary_source text,
  primary_source_slug text,
  last_synced_at timestamptz,
  rank_score double precision,
  total_count bigint
)
language sql
stable
as $$
  with normalized_query as (
    select lower(trim(unaccent(coalesce(search_keyword, '')))) as q
  ), ranked as (
    select
      m.id,
      m.slug,
      m.name,
      m.origin_name,
      m.year,
      m.type,
      m.thumb_url,
      m.poster_url,
      m.episode_current,
      m.episode_number,
      m.episode_state,
      m.season,
      m.quality,
      m.lang,
      m.category_slugs,
      m.country_slugs,
      m.vote_average,
      m.vote_count,
      m.popularity_score,
      m.primary_source,
      m.primary_source_slug,
      m.last_synced_at,
      (
        case when m.normalized_name = nq.q then 100 else 0 end +
        case when m.normalized_origin_name = nq.q then 90 else 0 end +
        case when m.normalized_name like nq.q || '%' then 45 else 0 end +
        case when m.normalized_origin_name like nq.q || '%' then 35 else 0 end +
        similarity(m.normalized_name, nq.q) * 30 +
        similarity(coalesce(m.normalized_origin_name, ''), nq.q) * 22 +
        similarity(m.search_text, nq.q) * 12 +
        least(coalesce(m.popularity_score, 0), 1000) / 1000 * 5 +
        least(coalesce(m.vote_count, 0), 5000) / 5000 * 3 +
        coalesce(m.vote_average, 0) / 10 * 2
      ) as rank_score
    from public.movies m
    cross join normalized_query nq
    where length(nq.q) >= 2
      and m.is_blocked = false
      and coalesce(m.episode_state, 'unknown') <> 'trailer'
      and (
        m.normalized_name % nq.q
        or coalesce(m.normalized_origin_name, '') % nq.q
        or m.search_text % nq.q
        or m.normalized_name like nq.q || '%'
        or coalesce(m.normalized_origin_name, '') like nq.q || '%'
        or m.search_text like '%' || nq.q || '%'
      )
  ), counted as (
    select ranked.*, count(*) over() as total_count
    from ranked
  )
  select *
  from counted
  order by rank_score desc, popularity_score desc nulls last, last_synced_at desc nulls last
  limit greatest(1, least(coalesce(page_size, 24), 48))
  offset (greatest(1, coalesce(page_number, 1)) - 1) * greatest(1, least(coalesce(page_size, 24), 48));
$$;
