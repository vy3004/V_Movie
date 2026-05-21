"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import SelectDropdown from "@/components/shared/SelectDropdown";

const itemTypeOptions = [
  "tv_series",
  "movie",
  "ova",
  "special",
  "live_action",
  "season",
  "other",
];

type CollectionItem = {
  id: string;
  collection_id: string;
  movie_id: string;
  slug: string;
  label: string;
  item_type: string;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type MovieCollection = {
  id: string;
  slug: string;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
  movie_collection_items?: CollectionItem[];
};

type CollectionFormState = {
  id?: string;
  slug: string;
  name: string;
};

type ItemFormState = {
  id: string;
  label: string;
  item_type: string;
  sort_order: string;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sortedItems(collection?: MovieCollection | null) {
  return [...(collection?.movie_collection_items || [])].sort(
    (left, right) =>
      left.sort_order - right.sort_order ||
      left.label.localeCompare(right.label),
  );
}

function collectionItemCount(collection: MovieCollection) {
  return collection.movie_collection_items?.length || 0;
}

export default function AdminCollectionsDashboard() {
  const [keyword, setKeyword] = useState("");
  const [collections, setCollections] = useState<MovieCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mutatingItemId, setMutatingItemId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [formCollection, setFormCollection] =
    useState<CollectionFormState | null>(null);
  const [managingCollectionId, setManagingCollectionId] = useState<
    string | null
  >(null);
  const [itemForms, setItemForms] = useState<Record<string, ItemFormState>>({});
  const [openItemTypeId, setOpenItemTypeId] = useState<string | null>(null);

  const managingCollection = useMemo(
    () =>
      collections.find(
        (collection) => collection.id === managingCollectionId,
      ) || null,
    [collections, managingCollectionId],
  );

  const loadCollections = useCallback(async (nextKeyword: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ keyword: nextKeyword.trim() });
      const response = await fetch(
        `/api/admin/movie-collections?${params.toString()}`,
      );
      const result = (await response.json().catch(() => ({}))) as {
        collections?: MovieCollection[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Không tải được collections");
      setCollections(result.collections || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không tải được collections",
      );
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCollections("");
  }, [loadCollections]);

  useEffect(() => {
    if (!managingCollection) return;
    setItemForms(
      Object.fromEntries(
        sortedItems(managingCollection).map((item) => [
          item.id,
          {
            id: item.id,
            label: item.label,
            item_type: item.item_type,
            sort_order: String(item.sort_order),
          },
        ]),
      ),
    );
  }, [managingCollection]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadCollections(keyword);
  }

  function openCreateDrawer() {
    setFormCollection({ slug: "", name: "" });
  }

  function openEditDrawer(collection: MovieCollection) {
    setFormCollection({
      id: collection.id,
      slug: collection.slug,
      name: collection.name,
    });
  }

  async function saveCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formCollection) return;

    const payload = {
      slug: formCollection.slug.trim(),
      name: formCollection.name.trim(),
    };

    if (!payload.slug || !payload.name) {
      setError("Nhập đủ slug và tên collection");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        formCollection.id
          ? `/api/admin/movie-collections/${formCollection.id}`
          : "/api/admin/movie-collections",
        {
          method: formCollection.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Không lưu được collection");
      setFormCollection(null);
      await loadCollections(keyword);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không lưu được collection",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveItem(itemId: string) {
    const nextItem = itemForms[itemId];
    if (!managingCollection || !nextItem) return;

    const sortOrder = Number(nextItem.sort_order);
    if (!nextItem.label.trim() || !Number.isFinite(sortOrder)) {
      setError("Item cần label và sort order hợp lệ");
      return;
    }

    setMutatingItemId(itemId);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/movie-collections/${managingCollection.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: nextItem.label.trim(),
            item_type: nextItem.item_type,
            sort_order: Math.floor(sortOrder),
          }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Không lưu được item");
      await loadCollections(keyword);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Không lưu được item",
      );
    } finally {
      setMutatingItemId(null);
    }
  }

  async function deleteItem(item: CollectionItem) {
    if (
      !managingCollection ||
      !window.confirm(`Xóa ${item.label} khỏi collection?`)
    )
      return;

    setMutatingItemId(item.id);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/movie-collections/${managingCollection.id}/items/${item.id}`,
        {
          method: "DELETE",
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Không xóa được item");
      await loadCollections(keyword);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Không xóa được item",
      );
    } finally {
      setMutatingItemId(null);
    }
  }

  return (
    <div className="space-y-6 text-zinc-100">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.4em] text-red-500">
            Collections
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            Collection Admin
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Quản lý collection, metadata và thứ tự phim trong từng bộ.
          </p>
          {error ? (
            <p className="mt-3 rounded-2xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300">
              {error}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={openCreateDrawer}
          className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-red-950/40 transition hover:bg-red-500"
        >
          New collection
        </button>
      </div>

      <form
        onSubmit={submitSearch}
        className="rounded-[26px] border border-zinc-800/90 bg-[#09090b] p-3 shadow-2xl shadow-black/35"
      >
        <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-zinc-800 bg-black px-4 transition focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-600/15">
          <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.75)]" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Search collection name or slug..."
            className="w-full bg-transparent text-sm font-semibold text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <button className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-500">
            Search
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-[28px] border border-zinc-800/90 bg-[#09090b] shadow-2xl shadow-black/35">
        <div className="flex items-center justify-between border-b border-zinc-900 px-5 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-red-500">
              Collection list
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              {collections.length} collections loaded
            </p>
          </div>
          {loading ? (
            <span className="rounded-full border border-red-500/25 bg-red-600/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-red-300">
              Loading
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 p-3 lg:grid-cols-2">
          {!loading && !collections.length ? (
            <div className="rounded-2xl border border-zinc-800 bg-black p-8 text-center text-sm font-bold text-zinc-500 lg:col-span-2">
              No collections found
            </div>
          ) : null}

          {collections.map((collection) => (
            <article
              key={collection.id}
              className="rounded-3xl border border-zinc-800 bg-black/80 p-4 transition hover:border-red-950 hover:bg-zinc-950"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black text-white">
                    {collection.name}
                  </h2>
                  <p className="mt-1 truncate text-sm font-semibold text-zinc-500">
                    {collection.slug}
                  </p>
                </div>
                <span className="rounded-full bg-red-600/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-red-300">
                  {collectionItemCount(collection)} items
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-xs font-bold text-zinc-500 sm:grid-cols-2">
                <span className="rounded-2xl bg-zinc-950 px-3 py-2">
                  Created: {formatDate(collection.created_at)}
                </span>
                <span className="rounded-2xl bg-zinc-950 px-3 py-2">
                  Updated: {formatDate(collection.updated_at)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEditDrawer(collection)}
                  className="rounded-2xl border border-zinc-700 px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-200 transition hover:border-red-500 hover:text-white"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setManagingCollectionId(collection.id)}
                  className="rounded-2xl bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-black transition hover:bg-zinc-200"
                >
                  Manage items
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {formCollection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
          <form
            onSubmit={saveCollection}
            className="w-full max-w-xl rounded-[32px] border border-red-950/70 bg-[#080808] p-6 text-zinc-100 shadow-2xl shadow-red-950/30"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-red-500">
                  Collection
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  {formCollection.id ? "Edit collection" : "New collection"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFormCollection(null)}
                className="rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:border-red-500 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
                Slug
                <input
                  value={formCollection.slug}
                  onChange={(event) =>
                    setFormCollection({
                      ...formCollection,
                      slug: event.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
                />
              </label>
              <label className="block text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
                Name
                <input
                  value={formCollection.name}
                  onChange={(event) =>
                    setFormCollection({
                      ...formCollection,
                      name: event.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
                />
              </label>
            </div>

            <button
              disabled={saving}
              className="mt-6 w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {saving ? "Saving..." : "Save collection"}
            </button>
          </form>
        </div>
      ) : null}

      {managingCollection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-[32px] border border-red-950/70 bg-[#080808] text-zinc-100 shadow-2xl shadow-red-950/30">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-900 p-5">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.35em] text-red-500">
                  Collection items
                </p>
                <h2 className="mt-2 truncate text-2xl font-black text-white">
                  {managingCollection.name}
                </h2>
                <p className="mt-1 truncate text-sm text-zinc-500">
                  {managingCollection.slug}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManagingCollectionId(null)}
                className="rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:border-red-500 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(94vh-112px)] space-y-3 overflow-y-auto p-4">
              {!sortedItems(managingCollection).length ? (
                <div className="rounded-2xl border border-zinc-800 bg-black p-8 text-center text-sm font-bold text-zinc-500">
                  Collection chưa có item. Thêm phim từ /admin/movies bằng nút
                  Gợi ý gộp collection.
                </div>
              ) : null}

              {sortedItems(managingCollection).map((item) => {
                const itemForm = itemForms[item.id] || {
                  id: item.id,
                  label: item.label,
                  item_type: item.item_type,
                  sort_order: String(item.sort_order),
                };
                const busy = mutatingItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className="rounded-3xl border border-zinc-800 bg-black p-4"
                  >
                    <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.4fr_auto] lg:items-end">
                      <label className="block text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
                        Label
                        <input
                          value={itemForm.label}
                          onChange={(event) =>
                            setItemForms((current) => ({
                              ...current,
                              [item.id]: {
                                ...itemForm,
                                label: event.target.value,
                              },
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-red-500"
                        />
                      </label>
                      <SelectDropdown
                        label="Type"
                        value={itemForm.item_type}
                        options={itemTypeOptions.map((type) => ({
                          label: type,
                          value: type,
                        }))}
                        open={openItemTypeId === item.id}
                        menuZIndex="z-[60]"
                        onToggle={() =>
                          setOpenItemTypeId(
                            openItemTypeId === item.id ? null : item.id,
                          )
                        }
                        onChange={(value) => {
                          setItemForms((current) => ({
                            ...current,
                            [item.id]: { ...itemForm, item_type: value },
                          }));
                          setOpenItemTypeId(null);
                        }}
                      />
                      <label className="block text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
                        Order
                        <input
                          type="number"
                          value={itemForm.sort_order}
                          onChange={(event) =>
                            setItemForms((current) => ({
                              ...current,
                              [item.id]: {
                                ...itemForm,
                                sort_order: event.target.value,
                              },
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-red-500"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void saveItem(item.id)}
                          className="rounded-2xl bg-red-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void deleteItem(item)}
                          className="rounded-2xl border border-zinc-700 px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-300 transition hover:border-red-500 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 truncate text-xs font-semibold text-zinc-600">
                      {item.slug} · movie_id: {item.movie_id}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
