﻿"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MovieCollectionDrawer from "@/app/(dashboard)/admin/movies/_components/MovieCollectionDrawer";
import MovieEditDrawer from "@/app/(dashboard)/admin/movies/_components/MovieEditDrawer";
import MovieMergeDrawer from "@/app/(dashboard)/admin/movies/_components/MovieMergeDrawer";
import SearchMovieResultCard from "@/components/shared/SearchMovieResultCard";
import { useData } from "@/providers/BaseDataContextProvider";
import SelectDropdown from "@/components/shared/SelectDropdown";
import type { CateCtr, MovieSource } from "@/types";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

type AdminMovie = {
  id: string;
  name: string;
  origin_name: string | null;
  slug: string;
  year: number | null;
  type: string | null;
  season: number | null;
  episode_current: string | null;
  episode_number: number;
  lang: string | null;
  quality: string | null;
  thumb_url: string | null;
  poster_url: string | null;
  primary_source: string | null;
  primary_source_slug: string | null;
  category_slugs: string[];
  country_slugs: string[];
  sources: Array<{ source?: string; slug?: string }>;
  merge_status: string;
  is_blocked: boolean;
  last_synced_at: string | null;
};

type AdminMoviesResponse = {
  items: AdminMovie[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type Filters = {
  keyword: string;
  blocked: string;
  mergeStatus: string;
  source: string;
  category: string;
  type: string;
  year: string;
  duplicateOnly: boolean;
};

const defaultFilters: Filters = {
  keyword: "",
  blocked: "active",
  mergeStatus: "all",
  source: "all",
  category: "",
  type: "",
  year: "",
  duplicateOnly: false,
};

export type { AdminMovie };

function getCategoryName(categories: CateCtr[] | undefined, slug: string) {
  return categories?.find((category) => category.slug === slug)?.name || slug;
}

function toSearchCardMovie(movie: AdminMovie) {
  return {
    name: movie.name,
    origin_name: movie.origin_name || movie.slug,
    year: movie.year || 0,
    thumb_url: movie.thumb_url || movie.poster_url || "",
    episode_current:
      movie.episode_current || `Tập ${movie.episode_number || 0}`,
    quality: movie.quality || "-",
    lang: movie.lang || "-",
    sources: movie.sources?.map((source) => source.source).filter(Boolean) as
      | MovieSource[]
      | undefined,
  };
}

export default function AdminMoviesDashboard() {
  const { categories } = useData();
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminMoviesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedIdsRef = useRef<string[]>([]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);
  const [selectedMovieMap, setSelectedMovieMap] = useState<
    Record<string, AdminMovie>
  >({});
  const [editingMovie, setEditingMovie] = useState<AdminMovie | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [blockingMovieId, setBlockingMovieId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [openFilter, setOpenFilter] = useState<keyof Filters | null>(null);

  const selectedMovies = useMemo(
    () => selectedIds.map((id) => selectedMovieMap[id]).filter(Boolean),
    [selectedIds, selectedMovieMap],
  );

  const visibleMovieIds = useMemo(
    () => (data?.items || []).map((movie) => movie.id),
    [data?.items],
  );
  const allVisibleSelected =
    visibleMovieIds.length > 0 &&
    visibleMovieIds.every((id) => selectedIds.includes(id));
  const categoryOptions = useMemo(
    () => [
      { label: "All categories", value: "" },
      ...(categories || []).map((category) => ({
        label: category.name,
        value: category.slug,
      })),
    ],
    [categories],
  );

  const loadMovies = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          keyword: filters.keyword,
          blocked: filters.blocked,
          mergeStatus: filters.mergeStatus,
          source: filters.source,
          category: filters.category,
          type: filters.type,
          year: filters.year,
          duplicateOnly: String(filters.duplicateOnly),
          page: String(nextPage),
          limit: "24",
        });

        const response = await fetch(`/api/admin/movies?${params.toString()}`);
        const nextData = (await response.json().catch(() => ({}))) as
          | AdminMoviesResponse
          | { error?: string };
        if (!response.ok || !("items" in nextData)) {
          const message = "error" in nextData ? nextData.error : undefined;
          throw new Error(message || "Failed to load movies");
        }

        setData(nextData);
        setSelectedMovieMap((current) => ({
          ...current,
          ...Object.fromEntries(
            nextData.items
              .filter((movie) => selectedIdsRef.current.includes(movie.id))
              .map((movie) => [movie.id, movie]),
          ),
        }));
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to load movies",
        );
        setData({
          items: [],
          pagination: { page: nextPage, limit: 24, total: 0, totalPages: 1 },
        });
      } finally {
        setLoading(false);
      }
    },
    [filters, page],
  );

  useEffect(() => {
    void loadMovies(page);
  }, [loadMovies, page]);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    void loadMovies(1);
  }

  function toggleMovie(movie: AdminMovie) {
    setSelectedIds((current) => {
      const selected = current.includes(movie.id);
      setSelectedMovieMap((map) => {
        if (!selected) return { ...map, [movie.id]: movie };
        const next = { ...map };
        delete next[movie.id];
        return next;
      });
      return selected
        ? current.filter((item) => item !== movie.id)
        : [...current, movie.id];
    });
  }

  function toggleAllVisibleMovies() {
    const visibleMovies = data?.items || [];
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !visibleMovieIds.includes(id)),
      );
      setSelectedMovieMap((current) => {
        const next = { ...current };
        visibleMovieIds.forEach((id) => delete next[id]);
        return next;
      });
      return;
    }

    setSelectedIds((current) =>
      Array.from(new Set([...current, ...visibleMovieIds])),
    );
    setSelectedMovieMap((current) => ({
      ...current,
      ...Object.fromEntries(visibleMovies.map((movie) => [movie.id, movie])),
    }));
  }

  async function toggleBlocked(movie: AdminMovie) {
    setBlockingMovieId(movie.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/movies/${movie.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_blocked: !movie.is_blocked }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error || "Failed to update movie");
      }
      await loadMovies(page);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to update movie",
      );
    } finally {
      setBlockingMovieId(null);
    }
  }

  return (
    <div className="space-y-6 text-zinc-100">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.4em] text-red-500">
            Indexed Library
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">Movie Admin</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Search, block, merge duplicates, and group franchise parts.
          </p>
          {error ? (
            <p className="mt-3 rounded-2xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={selectedMovies.length < 2}
            onClick={() => setMergeOpen(true)}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            Merge selected
          </button>
          <button
            disabled={!selectedMovies.length}
            onClick={() => setCollectionOpen(true)}
            className="rounded-2xl border border-red-500/70 bg-red-600/10 px-4 py-3 text-sm font-black text-red-100 shadow-lg shadow-red-950/20 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-transparent disabled:text-zinc-600"
          >
            Gợi ý gộp collection
          </button>
        </div>
      </div>

      <form
        onSubmit={submitFilters}
        className="rounded-[26px] border border-zinc-800/90 bg-[#09090b] p-3 shadow-2xl shadow-black/35"
      >
        <div className="space-y-3">
          <div className="flex min-h-12 items-center rounded-2xl border border-zinc-800 bg-black px-4 transition focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-600/15">
            <span className="mr-3 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.75)]" />
            <input
              className="w-full bg-transparent text-sm font-semibold text-zinc-100 outline-none placeholder:text-zinc-600"
              placeholder="Search movie, slug, origin name..."
              value={filters.keyword}
              onChange={(event) =>
                setFilters({ ...filters, keyword: event.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_1.35fr_1fr_auto]">
            <SelectDropdown
              label="Blocked"
              value={filters.blocked}
              options={[
                { label: "Active", value: "active" },
                { label: "Blocked", value: "blocked" },
                { label: "All", value: "all" },
              ]}
              open={openFilter === "blocked"}
              menuZIndex="z-30"
              buttonPadding="px-3"
              onToggle={() =>
                setOpenFilter(openFilter === "blocked" ? null : "blocked")
              }
              onChange={(value) => {
                setFilters({ ...filters, blocked: value });
                setOpenFilter(null);
              }}
            />
            <SelectDropdown
              label="Merge"
              value={filters.mergeStatus}
              options={[
                { label: "All merge", value: "all" },
                { label: "Merged", value: "merged" },
                { label: "Review", value: "review" },
              ]}
              open={openFilter === "mergeStatus"}
              menuZIndex="z-30"
              buttonPadding="px-3"
              onToggle={() =>
                setOpenFilter(
                  openFilter === "mergeStatus" ? null : "mergeStatus",
                )
              }
              onChange={(value) => {
                setFilters({ ...filters, mergeStatus: value });
                setOpenFilter(null);
              }}
            />
            <SelectDropdown
              label="Source"
              value={filters.source}
              options={[
                { label: "All sources", value: "all" },
                { label: "OPhim", value: "ophim" },
                { label: "PhimAPI", value: "phimapi" },
              ]}
              open={openFilter === "source"}
              menuZIndex="z-30"
              buttonPadding="px-3"
              onToggle={() =>
                setOpenFilter(openFilter === "source" ? null : "source")
              }
              onChange={(value) => {
                setFilters({ ...filters, source: value });
                setOpenFilter(null);
              }}
            />
            <SelectDropdown
              label="Category"
              value={filters.category}
              options={categoryOptions}
              open={openFilter === "category"}
              menuZIndex="z-30"
              buttonPadding="px-3"
              onToggle={() =>
                setOpenFilter(openFilter === "category" ? null : "category")
              }
              onChange={(value) => {
                setFilters({ ...filters, category: value });
                setOpenFilter(null);
              }}
            />
            <SelectDropdown
              label="Type"
              value={filters.type}
              options={[
                { label: "All types", value: "" },
                { label: "Single", value: "single" },
                { label: "Series", value: "series" },
                { label: "Hoạt hình", value: "hoathinh" },
                { label: "TV Shows", value: "tvshows" },
              ]}
              open={openFilter === "type"}
              menuZIndex="z-30"
              buttonPadding="px-3"
              onToggle={() =>
                setOpenFilter(openFilter === "type" ? null : "type")
              }
              onChange={(value) => {
                setFilters({ ...filters, type: value });
                setOpenFilter(null);
              }}
            />
            <button className="h-12 rounded-2xl bg-red-600 px-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-red-950/40 transition hover:bg-red-500 sm:col-span-3 xl:col-span-1">
              Search
            </button>
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-[28px] border border-zinc-800/90 bg-[#09090b] shadow-2xl shadow-black/35">
        <div className="flex flex-col gap-3 border-b border-zinc-900 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-red-500">
              Movie queue
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              {selectedMovies.length} selected / {data?.pagination.total || 0}{" "}
              total
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="rounded-full border border-red-500/25 bg-red-600/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-red-300">
                Syncing
              </span>
            ) : null}
            <span className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-zinc-500">
              24 / page
            </span>
          </div>
        </div>

        <div className="hidden md:block">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[36%]" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-zinc-950/90 text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
              <tr className="border-b border-zinc-900">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisibleMovies}
                    disabled={!visibleMovieIds.length}
                    aria-label="Select all visible movies"
                    className="h-4 w-4 accent-red-600 disabled:opacity-40"
                  />
                </th>
                <th className="px-4 py-3">Movie</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/80">
              {loading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="animate-pulse bg-black/30">
                      <td className="px-4 py-3">
                        <div className="h-4 w-4 rounded bg-zinc-800" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3 w-2/3 rounded bg-zinc-800" />
                        <div className="mt-3 h-3 w-1/2 rounded bg-zinc-900" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-6 w-40 rounded-full bg-zinc-800" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-6 w-16 rounded-full bg-zinc-800" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-6 w-20 rounded-full bg-zinc-800" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-6 w-12 rounded-full bg-zinc-800" />
                      </td>
                      <td className="px-5 py-3">
                        <div className="h-10 w-10 rounded-2xl bg-zinc-800" />
                      </td>
                    </tr>
                  ))
                : null}

              {!loading && !data?.items.length ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm font-bold text-zinc-500"
                  >
                    No movies found
                  </td>
                </tr>
              ) : null}

              {(data?.items || []).map((movie) => {
                const selected = selectedIds.includes(movie.id);
                return (
                  <tr
                    key={movie.id}
                    className={`group transition ${selected ? "bg-red-950/25 shadow-[inset_3px_0_0_rgb(220,38,38)]" : "bg-black/25 hover:bg-zinc-900/70"}`}
                  >
                    <td className="px-4 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleMovie(movie)}
                        aria-label={`Select ${movie.name}`}
                        className="h-4 w-4 accent-red-600"
                      />
                    </td>
                    <td className="min-w-0 px-4 py-3">
                      <SearchMovieResultCard movie={toSearchCardMovie(movie)} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        {(movie.category_slugs || [])
                          .slice(0, 3)
                          .map((category) => (
                            <span
                              key={category}
                              className="whitespace-normal rounded-full border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] font-bold leading-tight text-zinc-300"
                            >
                              {getCategoryName(categories, category)}
                            </span>
                          ))}
                        {movie.category_slugs.length > 3 ? (
                          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] font-bold text-zinc-500">
                            +{movie.category_slugs.length - 3}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center">
                        <span className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-[11px] font-black uppercase text-zinc-300">
                          {movie.type || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center">
                        <span
                          className={
                            movie.merge_status === "review"
                              ? "rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] font-black uppercase text-amber-300"
                              : "rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-black uppercase text-emerald-300"
                          }
                        >
                          {movie.merge_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => void toggleBlocked(movie)}
                          disabled={blockingMovieId === movie.id}
                          role="switch"
                          aria-checked={!movie.is_blocked}
                          aria-label={`${movie.is_blocked ? "Unblock" : "Block"} ${movie.name}`}
                          className={`relative h-6 w-12 shrink-0 rounded-full transition-all ${blockingMovieId === movie.id ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${movie.is_blocked ? "bg-zinc-500" : "bg-red-600"}`}
                        >
                          <span
                            className={`absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white transition-transform ${movie.is_blocked ? "" : "translate-x-6"}`}
                          >
                            {blockingMovieId === movie.id ? (
                              <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-zinc-300 border-t-red-600" />
                            ) : null}
                          </span>
                        </button>
                      </div>
                    </td>
                    <td className="relative px-5 py-3 align-middle">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenActionId((current) =>
                              current === movie.id ? null : movie.id,
                            )
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-black text-xl leading-none text-zinc-300 transition hover:border-red-500 hover:bg-red-600/10 hover:text-white"
                          aria-label={`Open actions for ${movie.name}`}
                        >
                          <EllipsisVerticalIcon className="h-5 w-5" />
                        </button>
                      </div>
                      {openActionId === movie.id ? (
                        <div className="absolute right-5 top-12 z-20 w-36 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMovie(movie);
                              setOpenActionId(null);
                            }}
                            className="block w-full px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-zinc-200 transition hover:bg-red-600 hover:text-white"
                          >
                            Edit
                          </button>
                          <Link
                            href={`/phim/${movie.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpenActionId(null)}
                            className="block px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
                          >
                            Preview
                          </Link>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-3 md:hidden">
          {loading && !data
            ? Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-2xl border border-zinc-800 bg-black p-3"
                >
                  <div className="flex gap-3">
                    <div className="h-20 w-14 rounded-xl bg-zinc-800" />
                    <div className="flex-1 pt-1">
                      <div className="h-3 w-3/4 rounded bg-zinc-800" />
                      <div className="mt-3 h-3 w-1/2 rounded bg-zinc-900" />
                      <div className="mt-4 h-6 w-24 rounded-full bg-zinc-800" />
                    </div>
                  </div>
                </div>
              ))
            : null}

          {!loading && !data?.items.length ? (
            <div className="rounded-2xl border border-zinc-800 bg-black p-8 text-center text-sm font-bold text-zinc-500">
              No movies found
            </div>
          ) : null}

          {(data?.items || []).map((movie) => {
            const selected = selectedIds.includes(movie.id);
            return (
              <div
                key={movie.id}
                className={`rounded-2xl border p-3 transition ${selected ? "border-red-700 bg-red-950/20" : "border-zinc-800 bg-black hover:border-zinc-700"}`}
              >
                <div className="flex gap-3">
                  <label className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleMovie(movie)}
                      className="h-4 w-4 accent-red-600"
                    />
                  </label>
                  <SearchMovieResultCard
                    movie={toSearchCardMovie(movie)}
                    className="flex-1 p-0"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(movie.category_slugs || []).slice(0, 4).map((category) => (
                    <span
                      key={category}
                      className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] font-bold text-zinc-400"
                    >
                      {getCategoryName(categories, category)}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-900 pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] font-black uppercase text-zinc-300">
                      {movie.type || "-"}
                    </span>
                    <span
                      className={
                        movie.merge_status === "review"
                          ? "rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase text-amber-300"
                          : "rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase text-emerald-300"
                      }
                    >
                      {movie.merge_status}
                    </span>
                    <button
                      type="button"
                      onClick={() => void toggleBlocked(movie)}
                      disabled={blockingMovieId === movie.id}
                      role="switch"
                      aria-checked={!movie.is_blocked}
                      aria-label={`${movie.is_blocked ? "Unblock" : "Block"} ${movie.name}`}
                      className={`relative h-6 w-12 shrink-0 rounded-full transition-all ${blockingMovieId === movie.id ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${movie.is_blocked ? "bg-zinc-500" : "bg-red-600"}`}
                    >
                      <span
                        className={`absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white transition-transform ${movie.is_blocked ? "" : "translate-x-6"}`}
                      >
                        {blockingMovieId === movie.id ? (
                          <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-zinc-300 border-t-red-600" />
                        ) : null}
                      </span>
                    </button>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenActionId((current) =>
                          current === movie.id ? null : movie.id,
                        )
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-xl leading-none text-zinc-300 transition hover:border-red-500 hover:text-white"
                      aria-label={`Open actions for ${movie.name}`}
                    >
                      <EllipsisVerticalIcon className="h-5 w-5" />
                    </button>
                    {openActionId === movie.id ? (
                      <div className="absolute bottom-12 right-0 z-20 w-36 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMovie(movie);
                            setOpenActionId(null);
                          }}
                          className="block w-full px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-zinc-200 transition hover:bg-red-600 hover:text-white"
                        >
                          Edit
                        </button>
                        <Link
                          href={`/phim/${movie.slug}`}
                          target="_blank"
                          onClick={() => setOpenActionId(null)}
                          className="block px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
                        >
                          Preview
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={page <= 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          className="rounded-xl border border-zinc-800 px-3 py-2 disabled:text-zinc-700"
        >
          Prev
        </button>
        <span>
          Page {data?.pagination.page || page} /{" "}
          {data?.pagination.totalPages || 1}
        </span>
        <button
          disabled={Boolean(data && page >= data.pagination.totalPages)}
          onClick={() => setPage((value) => value + 1)}
          className="rounded-xl border border-zinc-800 px-3 py-2 disabled:text-zinc-700"
        >
          Next
        </button>
      </div>

      <MovieEditDrawer
        movie={editingMovie}
        onClose={() => setEditingMovie(null)}
        onSaved={() => void loadMovies(page)}
      />
      <MovieMergeDrawer
        movies={selectedMovies}
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        onMerged={() => {
          setSelectedIds([]);
          setSelectedMovieMap({});
          void loadMovies(page);
        }}
      />
      <MovieCollectionDrawer
        movies={selectedMovies}
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
      />
    </div>
  );
}
