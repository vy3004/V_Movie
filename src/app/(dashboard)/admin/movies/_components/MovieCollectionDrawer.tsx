"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { AdminMovie } from "@/app/(dashboard)/admin/movies/_components/AdminMoviesDashboard";
import SelectDropdown from "@/components/shared/SelectDropdown";

type CollectionOption = {
  id: string;
  slug: string;
  name: string;
  movie_collection_items?: unknown[];
};

type CollectionSuggestion = {
  name: string;
  slug: string;
  confidence: number;
  reason: string;
  existingCollection: CollectionOption | null;
  items: Array<{
    movie_id: string;
    slug: string;
    label: string;
    item_type: string;
    sort_order: number;
    confidence: number;
    reason: string;
    movie?: AdminMovie;
  }>;
};

const itemTypeOptions = [
  "tv_series",
  "movie",
  "ova",
  "special",
  "live_action",
  "season",
  "other",
];
const LOW_CONFIDENCE_THRESHOLD = 75;

const numericStringSchema = z
  .string()
  .min(1, "Must be a number")
  .refine((value) => /^\d+$/.test(value), "Must be a number");

const collectionSchema = z
  .object({
    mode: z.enum(["existing", "new"]),
    collectionId: z.string(),
    slug: z.string(),
    name: z.string(),
    items: z.array(
      z.object({
        movie_id: z.string().min(1),
        slug: z.string().min(1),
        label: z.string().min(1),
        item_type: z.string().min(1),
        sort_order: numericStringSchema,
        confidence: z.number().optional(),
        reason: z.string().optional(),
      }),
    ),
  })
  .superRefine((value, context) => {
    if (value.mode === "existing" && !value.collectionId.trim()) {
      context.addIssue({
        code: "custom",
        path: ["collectionId"],
        message: "Choose collection",
      });
    }
    if (value.mode === "new" && !value.slug.trim()) {
      context.addIssue({
        code: "custom",
        path: ["slug"],
        message: "Slug required",
      });
    }
    if (value.mode === "new" && !value.name.trim()) {
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "Name required",
      });
    }
  });

type CollectionFormValues = z.infer<typeof collectionSchema>;

function defaultItems(movies: AdminMovie[]): CollectionFormValues["items"] {
  return movies.map((movie, index) => ({
    movie_id: movie.id,
    slug: movie.slug,
    label: movie.name,
    item_type: movie.type === "series" ? "tv_series" : "movie",
    sort_order: String((index + 1) * 10),
    confidence: 100,
    reason: "selected manually",
  }));
}

function collectionLabel(collection: CollectionOption) {
  const count = collection.movie_collection_items?.length || 0;
  return `${collection.name} · ${collection.slug} · ${count} items`;
}

function suggestionItems(
  suggestion: CollectionSuggestion,
): CollectionFormValues["items"] {
  return suggestion.items.map((item, index) => ({
    movie_id: item.movie_id,
    slug: item.slug,
    label: item.label,
    item_type: item.item_type,
    sort_order: String((index + 1) * 10),
    confidence: item.confidence,
    reason: item.reason,
  }));
}

export default function MovieCollectionDrawer({
  movies,
  open,
  onClose,
}: {
  movies: AdminMovie[];
  open: boolean;
  onClose: () => void;
}) {
  const form = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      mode: "existing",
      collectionId: "",
      slug: "",
      name: "",
      items: [],
    },
  });
  const { control, handleSubmit, register, setValue } = form;
  const values = useWatch({ control }) as CollectionFormValues;
  const { fields, move, remove, replace } = useFieldArray({
    control,
    name: "items",
  });
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const movieLookup = useMemo(
    () => new Map(movies.map((movie) => [movie.id, movie])),
    [movies],
  );
  const selectedMovieKey = useMemo(
    () => movies.map((movie) => movie.id).join("|"),
    [movies],
  );
  const moviesRef = useRef(movies);
  const [keyword, setKeyword] = useState("");
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openItemTypeIdx, setOpenItemTypeIdx] = useState<number | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<CollectionSuggestion[]>([]);
  const [suggestionError, setSuggestionError] = useState("");
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<
    number | null
  >(null);

  const selectedCollection = useMemo(
    () =>
      collections.find((collection) => collection.id === values?.collectionId),
    [collections, values?.collectionId],
  );

  useEffect(() => {
    moviesRef.current = movies;
  }, [movies]);

  useEffect(() => {
    if (!open) return;
    form.reset({
      mode: "existing",
      collectionId: "",
      slug: "",
      name: "",
      items: defaultItems(moviesRef.current),
    });
    setKeyword("");
    setError("");
    setSuggestionError("");
    setSuggestions([]);
    setSelectedSuggestionIndex(null);
  }, [form, open, selectedMovieKey]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();

    async function loadCollections() {
      setLoadingCollections(true);
      try {
        const params = new URLSearchParams({ keyword });
        const response = await fetch(
          `/api/admin/movie-collections?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("Không tải được collection");
        const data = (await response.json()) as {
          collections?: CollectionOption[];
        };
        setCollections(data.collections || []);
      } catch (loadError) {
        if (
          !(
            loadError instanceof DOMException && loadError.name === "AbortError"
          )
        ) {
          setCollections([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoadingCollections(false);
      }
    }

    void loadCollections();
    return () => controller.abort();
  }, [keyword, open]);

  if (!open) return null;

  async function loadSuggestions() {
    setSuggesting(true);
    setSuggestionError("");
    setSuggestions([]);
    setSelectedSuggestionIndex(null);
    try {
      const response = await fetch("/api/admin/movie-collections/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieIds: moviesRef.current.map((movie) => movie.id),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        suggestions?: CollectionSuggestion[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Không tạo được gợi ý collection");
      setSuggestions(result.suggestions || []);
      if (!result.suggestions?.length)
        setSuggestionError("Không tìm thấy gợi ý đủ tin cậy");
    } catch (loadError) {
      setSuggestionError(
        loadError instanceof Error
          ? loadError.message
          : "Không tạo được gợi ý collection",
      );
    } finally {
      setSuggesting(false);
    }
  }

  function applySuggestion(suggestion: CollectionSuggestion, index: number) {
    setSelectedSuggestionIndex(index);
    if (suggestion.existingCollection?.id) {
      setValue("mode", "existing", { shouldDirty: true });
      setValue("collectionId", suggestion.existingCollection.id, {
        shouldDirty: true,
      });
    } else {
      setValue("mode", "new", { shouldDirty: true });
      setValue("collectionId", "", { shouldDirty: true });
      setValue("slug", suggestion.slug, { shouldDirty: true });
      setValue("name", suggestion.name, { shouldDirty: true });
    }
    replace(suggestionItems(suggestion));
  }

  function removeLowConfidenceItems() {
    replace(
      (values?.items || []).filter(
        (item) => (item.confidence ?? 100) >= LOW_CONFIDENCE_THRESHOLD,
      ),
    );
  }

  function sortSuggestedItems() {
    replace(
      [...(values?.items || [])]
        .sort(
          (a, b) =>
            Number(a.sort_order) - Number(b.sort_order) ||
            a.label.localeCompare(b.label),
        )
        .map((item, index) => ({
          ...item,
          sort_order: String((index + 1) * 10),
        })),
    );
  }

  async function submit(nextValues: CollectionFormValues) {
    setSaving(true);
    setError("");
    try {
      let targetCollectionId = nextValues.collectionId.trim();

      if (nextValues.mode === "new") {
        const response = await fetch("/api/admin/movie-collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: nextValues.slug.trim(),
            name: nextValues.name.trim(),
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.collection?.id)
          throw new Error(result.error || "Không tạo được collection");
        targetCollectionId = result.collection.id;
      }

      if (!targetCollectionId)
        throw new Error("Chọn collection hoặc tạo collection mới");

      const response = await fetch(
        `/api/admin/movie-collections/${targetCollectionId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: nextValues.items.map((item, index) => ({
              movie_id: item.movie_id,
              slug: item.slug,
              label: item.label,
              item_type: item.item_type,
              sort_order: Number(item.sort_order) || (index + 1) * 10,
            })),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Không lưu được collection items");

      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Không lưu được collection",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-[32px] border border-red-950/70 bg-[#080808] text-zinc-100 shadow-2xl shadow-red-950/30">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-900 p-5 sm:p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-red-500">
              Collection builder
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">
              Add {movies.length} movies
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Chọn collection có sẵn hoặc tạo collection mới, chỉnh metadata
              trước khi lưu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:border-red-500 hover:text-white"
          >
            Close
          </button>
        </div>

        <form
          onSubmit={handleSubmit(submit)}
          className="grid max-h-[calc(94vh-112px)] overflow-hidden lg:grid-cols-[360px_1fr]"
        >
          <aside className="max-h-[calc(94vh-112px)] overflow-y-auto border-r border-zinc-900 bg-black p-4">
            <button
              type="button"
              disabled={suggesting || !movies.length}
              onClick={loadSuggestions}
              className="mb-4 w-full rounded-2xl bg-red-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {suggesting ? "Đang phân tích..." : "Gợi ý collection thông minh"}
            </button>
            {suggestionError ? (
              <p className="mb-4 rounded-2xl border border-amber-900 bg-amber-950/20 p-3 text-xs font-bold text-amber-300">
                {suggestionError}
              </p>
            ) : null}
            {suggestions.length ? (
              <div className="mb-4 space-y-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.slug}-${index}`}
                    type="button"
                    onClick={() => applySuggestion(suggestion, index)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedSuggestionIndex === index
                        ? "border-red-500 bg-red-600/15 text-white"
                        : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-black">
                        {suggestion.name}
                      </span>
                      <span className="rounded-full bg-black px-2 py-1 text-[10px] font-black text-red-300">
                        {suggestion.confidence}%
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-zinc-500">
                      {suggestion.slug}
                    </span>
                    <span className="mt-2 block text-[10px] font-black uppercase tracking-widest text-zinc-600">
                      {suggestion.items.length} items ·{" "}
                      {suggestion.existingCollection
                        ? "match existing"
                        : "new draft"}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              {[
                ["existing", "Existing"],
                ["new", "New"],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    setValue("mode", mode as CollectionFormValues["mode"], {
                      shouldDirty: true,
                    })
                  }
                  className={`rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-widest transition ${
                    values?.mode === mode
                      ? "border-red-500 bg-red-600 text-white"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {values?.mode === "existing" ? (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
                  Search collection
                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="Tên hoặc slug"
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
                  />
                </label>
                {loadingCollections ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xs font-black uppercase tracking-widest text-zinc-500">
                    Loading collections
                  </div>
                ) : null}
                <div className="space-y-2">
                  {collections.map((collection) => {
                    const selected = values?.collectionId === collection.id;
                    return (
                      <button
                        key={collection.id}
                        type="button"
                        onClick={() =>
                          setValue("collectionId", collection.id, {
                            shouldDirty: true,
                          })
                        }
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-red-500 bg-red-600/15 text-white"
                            : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
                        }`}
                      >
                        <span className="block truncate text-sm font-black">
                          {collection.name}
                        </span>
                        <span className="mt-1 block truncate text-xs text-zinc-500">
                          {collection.slug}
                        </span>
                        <span className="mt-2 block text-[10px] font-black uppercase tracking-widest text-zinc-600">
                          {collection.movie_collection_items?.length || 0} items
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
                  New slug
                  <input
                    {...register("slug")}
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
                  />
                </label>
                <label className="block text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
                  New name
                  <input
                    {...register("name")}
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
                  />
                </label>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-zinc-900 bg-zinc-950 p-4 text-xs text-zinc-500">
              Target:{" "}
              {values?.mode === "new"
                ? values?.name || "New collection"
                : selectedCollection
                  ? collectionLabel(selectedCollection)
                  : "No collection selected"}
            </div>
          </aside>

          <main className="max-h-[calc(94vh-112px)] overflow-y-auto p-5 sm:p-7">
            {error ? (
              <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-600/10 p-4 text-sm font-bold text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">
                  Collection items
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Chỉnh label, type, sort order; kéo logic bằng nút lên/xuống.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={removeLowConfidenceItems}
                  disabled={
                    !fields.some(
                      (field) =>
                        (field.confidence ?? 100) < LOW_CONFIDENCE_THRESHOLD,
                    )
                  }
                  className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs font-black uppercase tracking-widest text-zinc-500 transition hover:border-red-500 hover:text-white disabled:opacity-40"
                >
                  Remove low-confidence
                </button>
                <button
                  type="button"
                  onClick={sortSuggestedItems}
                  className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs font-black uppercase tracking-widest text-zinc-500 transition hover:border-red-500 hover:text-white"
                >
                  Sort suggested
                </button>
                <span className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs font-black uppercase tracking-widest text-zinc-500">
                  {fields.length} items
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => {
                const confidence =
                  values?.items?.[index]?.confidence ?? field.confidence ?? 100;
                return (
                  <div
                    key={field.id}
                    className="rounded-[24px] border border-zinc-900 bg-zinc-950/70 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-black text-white">
                            {movieLookup.get(field.movie_id)?.name ||
                              field.label}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${confidence < LOW_CONFIDENCE_THRESHOLD ? "bg-amber-950 text-amber-300" : "bg-emerald-950 text-emerald-300"}`}
                          >
                            {confidence}%
                          </span>
                        </div>
                        <p className="truncate text-xs text-zinc-500">
                          {field.slug}
                        </p>
                        {values?.items?.[index]?.reason || field.reason ? (
                          <p className="mt-1 truncate text-[11px] text-zinc-600">
                            {values?.items?.[index]?.reason || field.reason}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => move(index, index - 1)}
                          className="rounded-xl border border-zinc-800 px-3 py-2 text-xs font-bold text-zinc-400 disabled:text-zinc-700"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          disabled={index === fields.length - 1}
                          onClick={() => move(index, index + 1)}
                          className="rounded-xl border border-zinc-800 px-3 py-2 text-xs font-bold text-zinc-400 disabled:text-zinc-700"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="rounded-xl border border-red-950 bg-red-950/20 px-3 py-2 text-xs font-bold text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[1fr_180px_120px]">
                      <label className="block text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
                        Label
                        <input
                          {...register(`items.${index}.label`)}
                          className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
                        />
                      </label>

                      <label className="block text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
                        Sort
                        <input
                          {...register(`items.${index}.sort_order`)}
                          className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
                        />
                      </label>

                      <div className="block text-xs font-black uppercase tracking-[0.22em] text-zinc-500 space-y-2">
                        <label>Type</label>
                        <SelectDropdown
                          label=""
                          value={
                            values?.items?.[index]?.item_type || field.item_type
                          }
                          options={itemTypeOptions.map((type) => ({
                            value: type,
                            label: type,
                          }))}
                          open={openItemTypeIdx === index}
                          onToggle={() =>
                            setOpenItemTypeIdx(
                              openItemTypeIdx === index ? null : index,
                            )
                          }
                          onChange={(value) => {
                            setValue(`items.${index}.item_type`, value, {
                              shouldDirty: true,
                            });
                            setOpenItemTypeIdx(null);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              disabled={saving || !fields.length}
              className="mt-6 w-full rounded-2xl bg-red-600 px-4 py-4 font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-red-950/50 transition hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {saving ? "Saving..." : "Save collection items"}
            </button>
          </main>
        </form>
      </div>
    </div>
  );
}
