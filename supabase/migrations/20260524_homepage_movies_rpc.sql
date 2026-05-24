create or replace function public.get_homepage_movies(
  target_year integer default extract(year from now())::int,
  top_limit integer default 16,
  section_limit integer default 12
)
returns table (
  top_movies jsonb,
  sections jsonb
)
language sql
stable
as $$
  with limits as (
    select
      greatest(1, least(coalesce(top_limit, 16), 48)) as top_n,
      greatest(1, least(coalesce(section_limit, 12), 48)) as section_n
  ),
  base as (
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
      m.last_synced_at
    from public.movies m
    where m.is_blocked = false
      and coalesce(m.episode_state, 'unknown') <> 'trailer'
  ),
  top_ranked as (
    select
      b.*,
      row_number() over (
        order by
          case when b.year = target_year then 0 else 1 end,
          b.year desc,
          b.popularity_score desc nulls last,
          b.last_synced_at desc nulls last
      ) as rank_idx
    from base b
    where b.year in (target_year, target_year - 1)
      and b.vote_count > 0
      and b.vote_average is not null
  ),
  top_list as (
    select tr.*
    from top_ranked tr
    cross join limits l
    where tr.rank_idx <= l.top_n
  ),
  section_defs as (
    select *
    from (values
      ('phim-le'::text, 'Phim lẻ'::text, 'single'::text, 1),
      ('phim-bo'::text, 'Phim bộ'::text, 'series'::text, 2),
      ('tv-shows'::text, 'TV Shows'::text, 'tvshows'::text, 3),
      ('hoat-hinh'::text, 'Hoạt hình'::text, 'hoathinh'::text, 4)
    ) as v(slug, title, movie_type, sort_order)
  ),
  section_ranked as (
    select
      sd.slug,
      sd.title,
      sd.sort_order,
      b.id,
      b.slug as movie_slug,
      b.name,
      b.origin_name,
      b.year,
      b.type,
      b.thumb_url,
      b.poster_url,
      b.episode_current,
      b.episode_number,
      b.episode_state,
      b.season,
      b.quality,
      b.lang,
      b.category_slugs,
      b.country_slugs,
      b.vote_average,
      b.vote_count,
      b.popularity_score,
      b.primary_source,
      b.primary_source_slug,
      b.last_synced_at,
      row_number() over (
        partition by sd.slug
        order by b.year desc nulls last, b.last_synced_at desc nulls last
      ) as rank_idx
    from section_defs sd
    join base b on b.type = sd.movie_type
  ),
  section_limited as (
    select sr.*
    from section_ranked sr
    cross join limits l
    where sr.rank_idx <= l.section_n
  )
  select
    coalesce(
      (
        select jsonb_agg(to_jsonb(tl) - 'rank_idx' order by tl.rank_idx)
        from top_list tl
      ),
      '[]'::jsonb
    ) as top_movies,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'slug', sd.slug,
            'title', sd.title,
            'items', coalesce(items.items, '[]'::jsonb)
          )
          order by sd.sort_order
        )
        from section_defs sd
        left join lateral (
          select jsonb_agg(
            jsonb_build_object(
              'id', sl.id,
              'slug', sl.movie_slug,
              'name', sl.name,
              'origin_name', sl.origin_name,
              'year', sl.year,
              'type', sl.type,
              'thumb_url', sl.thumb_url,
              'poster_url', sl.poster_url,
              'episode_current', sl.episode_current,
              'episode_number', sl.episode_number,
              'episode_state', sl.episode_state,
              'season', sl.season,
              'quality', sl.quality,
              'lang', sl.lang,
              'category_slugs', sl.category_slugs,
              'country_slugs', sl.country_slugs,
              'vote_average', sl.vote_average,
              'vote_count', sl.vote_count,
              'popularity_score', sl.popularity_score,
              'primary_source', sl.primary_source,
              'primary_source_slug', sl.primary_source_slug,
              'last_synced_at', sl.last_synced_at
            )
            order by sl.rank_idx
          ) as items
          from section_limited sl
          where sl.slug = sd.slug
        ) items on true
      ),
      '[]'::jsonb
    ) as sections;
$$;
