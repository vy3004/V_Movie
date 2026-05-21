"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { AdminMovie } from "@/app/(dashboard)/admin/movies/_components/AdminMoviesDashboard";
import ImageCustom from "@/components/ui/ImageCustom";

type MergeField =
  | "name"
  | "origin_name"
  | "slug"
  | "year"
  | "type"
  | "episode_current"
  | "episode_number";

type SourceOption = {
  key: string;
  source: string;
  slug: string;
  movieName: string;
};

const mergeFields: MergeField[] = [
  "name",
  "origin_name",
  "slug",
  "year",
  "type",
  "episode_current",
  "episode_number",
];

const numericStringSchema = z
  .string()
  .refine((value) => !value || /^\d+$/.test(value), "Must be a number");

const mergeSchema = z.object({
  canonicalMovieId: z.string().min(1),
  fieldValues: z.object({
    name: z.string(),
    origin_name: z.string(),
    slug: z.string(),
    year: numericStringSchema,
    type: z.string(),
    episode_current: z.string(),
    episode_number: numericStringSchema,
    thumb_url: z.string(),
    poster_url: z.string(),
    primary_source: z.string(),
    primary_source_slug: z.string(),
  }),
});

type MergeFormValues = z.infer<typeof mergeSchema>;

function movieFieldValue(movie: AdminMovie, field: MergeField): string {
  const value = movie[field];
  return value === null || value === undefined ? "" : String(value);
}

function getDefaultValues(movie: AdminMovie): MergeFormValues {
  const firstSource = movie.primary_source && movie.primary_source_slug
    ? { source: movie.primary_source, slug: movie.primary_source_slug }
    : movie.sources?.find((source) => source.source && source.slug);
  return {
    canonicalMovieId: movie.id,
    fieldValues: {
      name: movie.name || "",
      origin_name: movie.origin_name || "",
      slug: movie.slug || "",
      year: movie.year ? String(movie.year) : "",
      type: movie.type || "",
      episode_current: movie.episode_current || "",
      episode_number: String(movie.episode_number || 0),
      thumb_url: movie.thumb_url || "",
      poster_url: movie.poster_url || "",
      primary_source: firstSource?.source || movie.primary_source || "",
      primary_source_slug: firstSource?.slug || movie.primary_source_slug || "",
    },
  };
}

function buildSourceOptions(movies: AdminMovie[]): SourceOption[] {
  const optionMap = new Map<string, SourceOption>();

  movies.forEach((movie) => {
    (movie.sources || []).forEach((sourceRef) => {
      if (!sourceRef.source || !sourceRef.slug) return;
      const key = `${sourceRef.source}::${sourceRef.slug}`;
      if (optionMap.has(key)) return;
      optionMap.set(key, {
        key,
        source: sourceRef.source,
        slug: sourceRef.slug,
        movieName: movie.name,
      });
    });
  });

  return Array.from(optionMap.values());
}

function FieldPicker({
  field,
  movies,
  value,
  onChange,
}: {
  field: MergeField;
  movies: AdminMovie[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-900 bg-zinc-950/70 p-4">
      <label className="block text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
        {field}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
        />
      </label>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {movies.map((movie) => {
          const movieValue = movieFieldValue(movie, field);
          const selected = movieValue === value;
          return (
            <button
              key={`${movie.id}-${field}`}
              type="button"
              onClick={() => onChange(movieValue)}
              className={`rounded-2xl border px-3 py-2 text-left transition ${
                selected
                  ? "border-red-500 bg-red-600/15 text-white"
                  : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-700 hover:text-white"
              }`}
            >
              <span className="block truncate text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {movie.name}
              </span>
              <span className="mt-1 block truncate text-xs font-bold">{movieValue || "-"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ImagePicker({
  label,
  aspect,
  field,
  movies,
  value,
  onChange,
}: {
  label: string;
  aspect: string;
  field: "thumb_url" | "poster_url";
  movies: AdminMovie[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-900 bg-zinc-950/70 p-4">
      <label className="block text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
        {label}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {movies.map((movie) => {
          const imageUrl = movie[field] || "";
          const selected = imageUrl === value;
          return (
            <button
              key={`${movie.id}-${field}`}
              type="button"
              onClick={() => onChange(imageUrl)}
              className={`overflow-hidden rounded-2xl border bg-black text-left transition ${
                selected ? "border-red-500 ring-2 ring-red-600/20" : "border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div className={`${aspect} bg-zinc-950`}>
                <ImageCustom
                  src={imageUrl}
                  alt={`${movie.name} ${label}`}
                  widths={[220, 440]}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="truncate px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {movie.name}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function MovieMergeDrawer({
  movies,
  open,
  onClose,
  onMerged,
}: {
  movies: AdminMovie[];
  open: boolean;
  onClose: () => void;
  onMerged: () => void;
}) {
  const form = useForm<MergeFormValues>({
    resolver: zodResolver(mergeSchema),
    defaultValues: movies[0] ? getDefaultValues(movies[0]) : undefined,
  });
  const { control, handleSubmit, setValue } = form;
  const values = useWatch({ control }) as MergeFormValues;
  const [openSection, setOpenSection] = useState("fields");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const moviesRef = useRef(movies);

  const selectedMovieKey = useMemo(() => movies.map((movie) => movie.id).join("|"), [movies]);
  const sourceOptions = useMemo(() => buildSourceOptions(movies), [movies]);
  const primarySourceKey = values?.fieldValues?.primary_source
    ? `${values.fieldValues.primary_source}::${values.fieldValues.primary_source_slug}`
    : "";

  useEffect(() => {
    moviesRef.current = movies;
  }, [movies]);

  useEffect(() => {
    const firstMovie = moviesRef.current[0];
    if (!open || !firstMovie) return;
    form.reset(getDefaultValues(firstMovie));
    setOpenSection("fields");
    setError("");
  }, [form, open, selectedMovieKey]);

  if (!open) return null;

  function copyMovie(movie: AdminMovie) {
    form.reset(getDefaultValues(movie));
  }

  function setField<K extends keyof MergeFormValues["fieldValues"]>(key: K, value: MergeFormValues["fieldValues"][K]) {
    setValue(`fieldValues.${key}`, value as never, { shouldDirty: true });
  }

  async function submit(nextValues: MergeFormValues) {
    setSubmitting(true);
    setError("");
    try {
      const fieldValues = {
        ...nextValues.fieldValues,
        year: nextValues.fieldValues.year ? Number(nextValues.fieldValues.year) : null,
        episode_number: Number(nextValues.fieldValues.episode_number || 0),
      };

      const response = await fetch("/api/admin/movies/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonicalMovieId: nextValues.canonicalMovieId,
          duplicateMovieIds: movies.map((movie) => movie.id).filter((id) => id !== nextValues.canonicalMovieId),
          fieldValues,
        }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error || "Merge failed");
      }
      onMerged();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Merge failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="max-h-[94vh] w-full max-w-7xl overflow-hidden rounded-[32px] border border-red-950/70 bg-[#080808] text-zinc-100 shadow-2xl shadow-red-950/30">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-900 p-5 sm:p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-red-500">Smart merge</p>
            <h2 className="mt-2 text-2xl font-black text-white">Merge {movies.length} movies</h2>
            <p className="mt-1 text-sm text-zinc-500">Chọn phim chính, field tốt nhất, ảnh tốt nhất, và nguồn chính.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:border-red-500 hover:text-white"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit(submit)} className="grid max-h-[calc(94vh-112px)] overflow-hidden lg:grid-cols-[360px_1fr]">
          <aside className="max-h-[calc(94vh-112px)] overflow-y-auto border-r border-zinc-900 bg-black p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-zinc-500">Canonical movie</p>
            <div className="space-y-3">
              {movies.map((movie) => {
                const selected = values?.canonicalMovieId === movie.id;
                return (
                  <button
                    key={movie.id}
                    type="button"
                    onClick={() => {
                      setValue("canonicalMovieId", movie.id, { shouldDirty: true });
                      copyMovie(movie);
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-red-500 bg-red-600/15 text-white"
                        : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 h-3 w-3 rounded-full border ${selected ? "border-red-500 bg-red-500" : "border-zinc-600"}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{movie.name}</span>
                        <span className="mt-1 block truncate text-xs text-zinc-500">
                          {movie.slug} · {movie.episode_number || 0} tập
                        </span>
                        <span className="mt-2 block text-[10px] font-black uppercase tracking-widest text-zinc-600">
                          {movie.sources?.length || 0} sources
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="max-h-[calc(94vh-112px)] overflow-y-auto p-5 sm:p-7">
            {error ? (
              <div className="mb-5 rounded-2xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300">
                {error}
              </div>
            ) : null}
            <div className="mb-5 grid gap-2 sm:grid-cols-4">
              {[
                ["fields", "Fields"],
                ["images", "Images"],
                ["sources", "Sources"],
                ["review", "Review"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOpenSection(key)}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-widest transition ${
                    openSection === key
                      ? "border-red-500 bg-red-600 text-white"
                      : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-700 hover:text-white"
                  }`}
                >
                  {label}
                  <ChevronDownIcon className={`size-3 ${openSection === key ? "rotate-180" : ""}`} />
                </button>
              ))}
            </div>

            {openSection === "fields" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {mergeFields.map((field) => (
                  <FieldPicker
                    key={field}
                    field={field}
                    movies={movies}
                    value={values?.fieldValues?.[field] || ""}
                    onChange={(value) => setField(field, value)}
                  />
                ))}
              </div>
            ) : null}

            {openSection === "images" ? (
              <div className="space-y-4">
                <ImagePicker
                  label="Thumb"
                  aspect="aspect-[2/3]"
                  field="thumb_url"
                  movies={movies}
                  value={values?.fieldValues?.thumb_url || ""}
                  onChange={(value) => setField("thumb_url", value)}
                />
                <ImagePicker
                  label="Poster"
                  aspect="aspect-video"
                  field="poster_url"
                  movies={movies}
                  value={values?.fieldValues?.poster_url || ""}
                  onChange={(value) => setField("poster_url", value)}
                />
              </div>
            ) : null}

            {openSection === "sources" ? (
              <div className="rounded-[28px] border border-zinc-900 bg-black p-4">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">Review sources</p>
                <p className="mt-1 text-xs text-zinc-500">Tất cả source vẫn được merge; chọn 1 source làm nguồn chính.</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {sourceOptions.map((source) => {
                    const selected = source.key === primarySourceKey;
                    return (
                      <button
                        key={source.key}
                        type="button"
                        onClick={() => {
                          setField("primary_source", source.source);
                          setField("primary_source_slug", source.slug);
                        }}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-red-500 bg-red-600/15 text-white"
                            : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
                        }`}
                      >
                        <span className="block text-xs font-black uppercase tracking-widest text-red-400">{source.source}</span>
                        <span className="mt-1 block truncate text-sm font-bold">{source.slug}</span>
                        <span className="mt-2 block truncate text-[10px] font-black uppercase tracking-widest text-zinc-600">
                          From {source.movieName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {openSection === "review" ? (
              <div className="space-y-4">
                <div className="rounded-[28px] border border-zinc-900 bg-black p-4">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">Final values</p>
                  <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
                    {Object.entries(values?.fieldValues || {}).map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-zinc-900 bg-zinc-950 p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{key}</p>
                        <p className="mt-1 break-words font-semibold">{String(value || "-")}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-red-950/70 bg-red-950/10 p-4 text-sm text-zinc-300">
                  Canonical giữ lại. {Math.max(0, movies.length - 1)} phim còn lại sẽ bị block sau merge.
                </div>
              </div>
            ) : null}

            <button
              disabled={submitting || !values?.canonicalMovieId || movies.length < 2}
              className="mt-6 w-full rounded-2xl bg-red-600 px-4 py-4 font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-red-950/50 transition hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {submitting ? "Merging..." : "Confirm merge"}
            </button>
          </main>
        </form>
      </div>
    </div>
  );
}
