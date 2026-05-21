export type CollectionItemInput = {
  movie_id: string;
  slug: string;
  label: string;
  item_type: string;
  sort_order: number;
};

const ITEM_TYPES = new Set(["tv_series", "movie", "ova", "special", "live_action", "season", "other"]);

export function normalizeCollectionItems(items: CollectionItemInput[]): CollectionItemInput[] {
  return items
    .map((item) => ({
      movie_id: item.movie_id,
      slug: item.slug.trim(),
      label: item.label.trim(),
      item_type: ITEM_TYPES.has(item.item_type) ? item.item_type : "other",
      sort_order: Number.isFinite(item.sort_order) ? item.sort_order : 0,
    }))
    .filter((item) => item.movie_id && item.slug && item.label)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}
