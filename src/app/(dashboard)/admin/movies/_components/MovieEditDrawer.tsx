"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import SelectDropdown, {
  type SelectDropdownOption,
} from "@/components/shared/SelectDropdown";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { AdminMovie } from "@/app/(dashboard)/admin/movies/_components/AdminMoviesDashboard";
import ImageCustom from "@/components/ui/ImageCustom";
import { useData } from "@/providers/BaseDataContextProvider";
import type { MovieSource, PageMovieData, ServerData } from "@/types";

const numericStringSchema = z
  .string()
  .refine((value) => !value || /^\d+$/.test(value), "Must be a number");

const movieEditSchema = z.object({
  name: z.string(),
  origin_name: z.string(),
  slug: z.string(),
  type: z.string(),
  year: numericStringSchema,
  episode_current: z.string(),
  episode_number: numericStringSchema,
  thumb_url: z.string(),
  poster_url: z.string(),
  merge_status: z.string(),
  category_slugs: z.array(z.string()),
  is_blocked: z.boolean(),
});

type FormState = z.infer<typeof movieEditSchema>;

const typeOptions: SelectDropdownOption[] = [
  { label: "Single", value: "single" },
  { label: "Series", value: "series" },
  { label: "Hoạt hình", value: "hoathinh" },
  { label: "TV Shows", value: "tvshows" },
];

const mergeOptions: SelectDropdownOption[] = [
  { label: "Merged", value: "merged" },
  { label: "Review", value: "review" },
];

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
      />
    </label>
  );
}

function ImagePreview({
  label,
  src,
  alt,
  aspect,
  error,
  onError,
}: {
  label: string;
  src: string;
  alt: string;
  aspect: string;
  error: boolean;
  onError: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className={`${aspect} bg-black`}>
        {error ? (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs font-black uppercase tracking-widest text-red-400">
            Image error
          </div>
        ) : (
          <ImageCustom
            src={src}
            alt={alt}
            widths={[260, 520]}
            onError={onError}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
        {label}
      </p>
    </div>
  );
}

export default function MovieEditDrawer({
  movie,
  onClose,
  onSaved,
}: {
  movie: AdminMovie | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { categories } = useData();
  const form = useForm<FormState>({
    resolver: zodResolver(movieEditSchema),
    defaultValues: {
      name: "",
      origin_name: "",
      slug: "",
      type: "",
      year: "",
      episode_current: "",
      episode_number: "0",
      thumb_url: "",
      poster_url: "",
      merge_status: "merged",
      category_slugs: [],
      is_blocked: false,
    },
  });
  const { control, handleSubmit, setValue } = form;
  const formValues = useWatch({ control }) as FormState;
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<MovieSource | "">("");
  const [previewEpisodeSlug, setPreviewEpisodeSlug] = useState("");
  const [previewData, setPreviewData] = useState<PageMovieData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imageErrors, setImageErrors] = useState({
    thumb: false,
    poster: false,
  });

  useEffect(() => {
    if (!movie) return;
    form.reset({
      name: movie.name || "",
      origin_name: movie.origin_name || "",
      slug: movie.slug || "",
      type: movie.type || "",
      year: movie.year ? String(movie.year) : "",
      episode_current: movie.episode_current || "",
      episode_number: String(movie.episode_number || 0),
      thumb_url: movie.thumb_url || "",
      poster_url: movie.poster_url || "",
      merge_status: movie.merge_status || "merged",
      category_slugs: movie.category_slugs || [],
      is_blocked: movie.is_blocked,
    });
    const firstSource = movie.sources?.find(
      (source) => source.source && source.slug,
    );
    setPreviewSource((firstSource?.source as MovieSource | undefined) || "");
    setPreviewEpisodeSlug("");
    setPreviewData(null);
    setPreviewOpen(false);
    setError("");
    setImageErrors({ thumb: false, poster: false });
  }, [form, movie]);

  const sourceOptions = useMemo(
    () =>
      (movie?.sources || [])
        .filter((source): source is { source: MovieSource; slug: string } =>
          Boolean(source.source && source.slug),
        )
        .map((source) => ({
          label: `${source.source}: ${source.slug}`,
          value: source.source,
        })),
    [movie?.sources],
  );

  const selectedSourceRef = useMemo(
    () =>
      movie?.sources?.find(
        (source) => source.source === previewSource && source.slug,
      ),
    [movie?.sources, previewSource],
  );

  useEffect(() => {
    if (!previewOpen || !selectedSourceRef?.source || !selectedSourceRef.slug)
      return;

    const controller = new AbortController();

    async function loadPreview() {
      setPreviewLoading(true);
      try {
        const params = new URLSearchParams({
          source: String(selectedSourceRef?.source),
          slug: String(selectedSourceRef?.slug),
        });
        const response = await fetch(
          `/api/movies/detail/enrich?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Preview load failed");
        const data = (await response.json()) as PageMovieData;
        setPreviewData(data);
        const firstServer = data.item?.episodes?.[0];
        const firstEpisode = firstServer?.server_data?.[0];
        setPreviewEpisodeSlug(
          firstServer && firstEpisode
            ? `${firstServer.server_name}::${firstEpisode.slug}`
            : "",
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setPreviewData(null);
          setPreviewEpisodeSlug("");
        }
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }

    void loadPreview();

    return () => controller.abort();
  }, [previewOpen, selectedSourceRef?.source, selectedSourceRef?.slug]);

  const episodeOptions = useMemo(() => {
    const episodes = previewData?.item?.episodes || [];
    return episodes.flatMap((server) =>
      server.server_data.map((episode) => ({
        label: `${server.server_name} - ${episode.name}`,
        value: `${server.server_name}::${episode.slug}`,
      })),
    );
  }, [previewData]);

  const selectedEpisode = useMemo<ServerData | null>(() => {
    const episodes = previewData?.item?.episodes || [];
    for (const server of episodes) {
      const episode = server.server_data.find(
        (item) => `${server.server_name}::${item.slug}` === previewEpisodeSlug,
      );
      if (episode) return episode;
    }
    return null;
  }, [previewData, previewEpisodeSlug]);

  const imagePreview = useMemo(
    () => ({
      thumb: formValues.thumb_url || "",
      poster: formValues.poster_url || "",
    }),
    [formValues.poster_url, formValues.thumb_url],
  );

  useEffect(() => {
    setImageErrors({ thumb: false, poster: false });
  }, [imagePreview.thumb, imagePreview.poster]);

  if (!movie) return null;

  const currentMovie = movie;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValue(key, value as never, { shouldDirty: true });
  }

  function toggleCategory(slug: string) {
    const next = formValues.category_slugs.includes(slug)
      ? formValues.category_slugs.filter((item) => item !== slug)
      : [...formValues.category_slugs, slug];
    setField("category_slugs", next);
  }

  async function submit(values: FormState) {
    setSaving(true);
    setError("");
    try {
      const patch = {
        ...values,
        year: values.year ? Number(values.year) : null,
        episode_number: Number(values.episode_number || 0),
      };
      const response = await fetch(`/api/admin/movies/${currentMovie.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error || "Failed to save movie");
      }
      onSaved();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to save movie");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="grid max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-[32px] border border-red-950/70 bg-[#080808] text-zinc-100 shadow-2xl shadow-red-950/30 lg:grid-cols-[340px_1fr]">
        <div className="hidden max-h-[94vh] overflow-y-auto border-r border-zinc-900 bg-black p-4 lg:block">
          <div className="space-y-4 pb-4">
            <ImagePreview
              label="Thumb"
              src={imagePreview.thumb}
              alt="Thumb preview"
              aspect="aspect-[2/3]"
              error={imageErrors.thumb}
              onError={() =>
                setImageErrors((current) => ({ ...current, thumb: true }))
              }
            />
            <ImagePreview
              label="Poster"
              src={imagePreview.poster}
              alt="Poster preview"
              aspect="aspect-video"
              error={imageErrors.poster}
              onError={() =>
                setImageErrors((current) => ({ ...current, poster: true }))
              }
            />
          </div>
        </div>

        <div className="max-h-[94vh] overflow-y-auto p-5 sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4 border-b border-zinc-900 pb-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-red-500">
                Admin modal editor
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                Edit movie
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:border-red-500 hover:text-white"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit(submit)} className="space-y-5">
            {error ? (
              <div className="rounded-2xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300">
                {error}
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldInput
                label="name"
                value={formValues.name}
                onChange={(value) => setField("name", value)}
              />
              <FieldInput
                label="origin_name"
                value={formValues.origin_name}
                onChange={(value) => setField("origin_name", value)}
              />
              <FieldInput
                label="slug"
                value={formValues.slug}
                onChange={(value) => setField("slug", value)}
              />
              <FieldInput
                label="year"
                value={formValues.year}
                onChange={(value) => setField("year", value)}
              />
              <SelectDropdown
                label="type"
                value={formValues.type}
                options={typeOptions}
                open={openMenu === "type"}
                onToggle={() =>
                  setOpenMenu(openMenu === "type" ? null : "type")
                }
                onChange={(value) => {
                  setField("type", value);
                  setOpenMenu(null);
                }}
              />
              <SelectDropdown
                label="merge_status"
                value={formValues.merge_status}
                options={mergeOptions}
                open={openMenu === "merge"}
                onToggle={() =>
                  setOpenMenu(openMenu === "merge" ? null : "merge")
                }
                onChange={(value) => {
                  setField("merge_status", value);
                  setOpenMenu(null);
                }}
              />
              <FieldInput
                label="episode_current"
                value={formValues.episode_current}
                onChange={(value) => setField("episode_current", value)}
              />
              <FieldInput
                label="episode_number"
                value={formValues.episode_number}
                onChange={(value) => setField("episode_number", value)}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <FieldInput
                label="thumb_url"
                value={formValues.thumb_url}
                onChange={(value) => setField("thumb_url", value)}
              />
              <FieldInput
                label="poster_url"
                value={formValues.poster_url}
                onChange={(value) => setField("poster_url", value)}
              />
            </div>

            <div className="rounded-[24px] border border-zinc-900 bg-zinc-950/70 p-4">
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === "categories" ? null : "categories")
                }
                className="flex w-full items-center justify-between text-left"
              >
                <span>
                  <span className="block text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
                    Categories
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-zinc-300">
                    {formValues.category_slugs.length} selected
                  </span>
                </span>
                <ChevronDownIcon
                  className={`size-3 transition-transform duration-300 ${openMenu ? "rotate-180" : ""}`}
                />
              </button>
              {openMenu === "categories" ? (
                <div className="mt-4 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                  {(categories || []).map((category) => {
                    const selected = formValues.category_slugs.includes(
                      category.slug,
                    );
                    return (
                      <button
                        key={category.slug}
                        type="button"
                        onClick={() => toggleCategory(category.slug)}
                        className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-xs font-black uppercase tracking-wider transition ${selected ? "border-red-500 bg-red-600 text-white" : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-700 hover:text-white"}`}
                      >
                        <span>{category.name}</span>
                        {selected ? <span>âœ“</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-red-950/70 bg-red-950/10 p-4 text-sm font-black text-zinc-100">
              <input
                type="checkbox"
                checked={formValues.is_blocked}
                onChange={(event) =>
                  setField("is_blocked", event.target.checked)
                }
                className="h-4 w-4 accent-red-600"
              />
              Block movie
            </label>

            <div className="rounded-[28px] border border-zinc-900 bg-black p-4">
              <button
                type="button"
                onClick={() => setPreviewOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="block text-xs font-black uppercase tracking-[0.24em] text-red-500">
                  Preview player
                </span>

                <span className="flex items-center gap-2">
                  {previewLoading ? (
                    <span className="rounded-full border border-red-500/25 bg-red-600/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-300">
                      Loading
                    </span>
                  ) : null}
                  <ChevronDownIcon
                    className={`size-4 text-zinc-500 transition-transform duration-300 ${previewOpen ? "rotate-180" : ""}`}
                  />
                </span>
              </button>

              {previewOpen ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <SelectDropdown
                      label="source"
                      value={previewSource}
                      options={sourceOptions}
                      open={openMenu === "source"}
                      onToggle={() =>
                        setOpenMenu(openMenu === "source" ? null : "source")
                      }
                      onChange={(value) => {
                        setPreviewSource(value as MovieSource);
                        setPreviewEpisodeSlug("");
                        setPreviewData(null);
                        setOpenMenu(null);
                      }}
                    />
                    <SelectDropdown
                      label="episode"
                      value={previewEpisodeSlug}
                      options={
                        episodeOptions.length
                          ? episodeOptions
                          : [{ label: "No episode", value: "" }]
                      }
                      open={openMenu === "episode"}
                      onToggle={() =>
                        setOpenMenu(openMenu === "episode" ? null : "episode")
                      }
                      onChange={(value) => {
                        setPreviewEpisodeSlug(value);
                        setOpenMenu(null);
                      }}
                    />
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                    {selectedEpisode?.link_embed ? (
                      <iframe
                        key={selectedEpisode.link_embed}
                        src={selectedEpisode.link_embed}
                        className="aspect-video w-full"
                        allowFullScreen
                        title={`${movie.name} preview`}
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center text-sm font-bold text-zinc-600">
                        No preview available
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            <button
              disabled={saving}
              className="w-full rounded-2xl bg-red-600 px-4 py-4 font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-red-950/50 transition hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
