import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { redis } from "@/lib/redis";

export type MovieCollectionLink = {
  movie_id: string;
  slug: string;
  label: string;
  item_type: string;
  sort_order: number;
  isCurrent: boolean;
};

export type MovieCollectionResult = {
  id: string;
  slug: string;
  name: string;
  items: MovieCollectionLink[];
};

type CollectionMembership = {
  collection_id: string;
  movie_id: string;
};

type CollectionItemRow = {
  movie_id: string;
  slug: string;
  label: string;
  item_type: string;
  sort_order: number;
  movie_collections: { id: string; slug: string; name: string } | null;
  movies: { id: string; slug: string; is_blocked: boolean } | null;
};

export const MovieCollectionsService = {
  async getForMovieId(movieId: string): Promise<MovieCollectionResult | null> {
    // Redis cache check
    const cacheKey = `collection:movie:${movieId}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return typeof cached === "string" ? JSON.parse(cached) as MovieCollectionResult : cached as MovieCollectionResult;
      }
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("movie_collection_items")
      .select("collection_id, movie_id")
      .eq("movie_id", movieId)
      .maybeSingle();

    if (membershipError) throw membershipError;
    const currentMembership = membership as CollectionMembership | null;
    if (!currentMembership?.collection_id) return null;

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("movie_collection_items")
      .select("movie_id, slug, label, item_type, sort_order, movie_collections(id, slug, name), movies(id, slug, is_blocked)")
      .eq("collection_id", currentMembership.collection_id)
      .order("sort_order", { ascending: true });

    if (itemsError) throw itemsError;

    const rows = (items || []) as unknown as CollectionItemRow[];
    const visibleRows = rows.filter((item) => item.movies && !item.movies.is_blocked);
    const collection = visibleRows[0]?.movie_collections;
    if (!collection) return null;

    const result = {
      id: collection.id,
      slug: collection.slug,
      name: collection.name,
      items: visibleRows.map((item) => ({
        movie_id: item.movie_id,
        slug: item.movies?.slug || item.slug,
        label: item.label,
        item_type: item.item_type,
        sort_order: item.sort_order,
        isCurrent: item.movie_id === movieId,
      })),
    };

    // Cache 1h
    if (redis && result.items.length > 0) {
      await redis.set(cacheKey, JSON.stringify(result), { ex: 3600 });
    }

    return result;
  },
};
