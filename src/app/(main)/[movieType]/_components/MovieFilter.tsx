"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import NProgress from "nprogress";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

import BreadCrumb from "@/components/layout/BreadCrumb";
import SelectDropdown, { type SelectDropdownOption } from "@/components/shared/SelectDropdown";
import { useData } from "@/providers/BaseDataContextProvider";
import { BreadCrumb as BreadCrumbType } from "@/types";
import { typesMovie } from "@/lib/configs";

const STATUS_OPTIONS = [
  { value: "ongoing", label: "Đang chiếu" },
  { value: "completed", label: "Hoàn tất" },
  { value: "trailer", label: "Trailer" },
];

const QUALITY_OPTIONS = ["HD", "FHD", "FULLHD"].map((value) => ({
  value,
  label: value,
}));

const LANG_OPTIONS = [
  { value: "Vietsub", label: "Vietsub" },
  { value: "Thuyết Minh", label: "Thuyết minh" },
  { value: "Lồng Tiếng", label: "Lồng tiếng" },
];

const SORT_OPTIONS = [
  { value: "year_latest", label: "Năm mới + cập nhật" },
  { value: "updated", label: "Mới cập nhật" },
  { value: "popular", label: "Phổ biến" },
  { value: "rating", label: "Điểm cao" },
  { value: "episode_number", label: "Nhiều tập" },
];
function buildYears() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - 1989 }, (_, index) => {
    const year = String(currentYear - index);
    return { value: year, label: year };
  });
}
type FilterKey =
  | "movieType"
  | "category"
  | "country"
  | "year"
  | "status"
  | "quality"
  | "lang"
  | "sort_field";

const withPlaceholder = (
  placeholder: string,
  options: SelectDropdownOption[],
): SelectDropdownOption[] => [{ value: "", label: placeholder }, ...options];

interface MovieFilterProps {
  breadCrumb: BreadCrumbType[];
}

const MovieFilter = ({ breadCrumb }: MovieFilterProps) => {
  const router = useRouter();
  const params = useParams<{ movieType: string }>();
  const searchParams = useSearchParams();
  const { categories, countries } = useData();
  const years = useMemo(buildYears, []);

  const [showFilters, setShowFilters] = useState(false);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [filters, setFilters] = useState({
    year: searchParams.get("year") || "",
    category: searchParams.get("category") || "",
    country: searchParams.get("country") || "",
    movieType: searchParams.get("type") || "",
    status: searchParams.get("status") || "",
    quality: searchParams.get("quality") || "",
    lang: searchParams.get("lang") || "",
    sort_field: searchParams.get("sort_field") || "year_latest",
  });

  const movieTypeSlug = params?.movieType || "phim-moi-cap-nhat";

  const filterLabels = useMemo(() => {
    const categoryMap = new Map(categories?.map((item) => [item.slug, item.name]));
    const countryMap = new Map(countries?.map((item) => [item.slug, item.name]));
    const typeMap = new Map(Object.values(typesMovie).map((item) => [item.slug, item.name]));
    const optionMaps: Record<string, Map<string, string>> = {
      category: categoryMap,
      country: countryMap,
      movieType: typeMap,
      status: new Map(STATUS_OPTIONS.map((item) => [item.value, item.label])),
      quality: new Map(QUALITY_OPTIONS.map((item) => [item.value, item.label])),
      lang: new Map(LANG_OPTIONS.map((item) => [item.value, item.label])),
      sort_field: new Map(SORT_OPTIONS.map((item) => [item.value, item.label])),
      year: new Map(years.map((item) => [item.value, item.label])),
    };
    return optionMaps;
  }, [categories, countries, years]);

  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => value && !(key === "sort_field" && value === "year_latest"),
  );

  const pushFilters = (nextFilters = filters) => {
    const query = new URLSearchParams(searchParams.toString());
    const nextMovieType = nextFilters.movieType || movieTypeSlug;

    ["year", "category", "country", "status", "quality", "lang", "source", "sort_field", "type"].forEach((key) => query.delete(key));

    if (nextFilters.year) query.set("year", nextFilters.year);
    if (nextFilters.category) query.set("category", nextFilters.category);
    if (nextFilters.country) query.set("country", nextFilters.country);
    if (nextFilters.status) query.set("status", nextFilters.status);
    if (nextFilters.quality) query.set("quality", nextFilters.quality);
    if (nextFilters.lang) query.set("lang", nextFilters.lang);
    if (nextFilters.sort_field && nextFilters.sort_field !== "year_latest") {
      query.set("sort_field", nextFilters.sort_field);
    }
    if (nextFilters.movieType) query.set("type", nextFilters.movieType);
    query.delete("page");

    NProgress.start();
    router.push(`/${nextMovieType}${query.toString() ? `?${query.toString()}` : ""}`);
  };

  const setFilterValue = (key: FilterKey, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setOpenFilter(null);
  };

  const removeFilter = (key: string) => {
    const nextFilters = { ...filters, [key]: key === "sort_field" ? "year_latest" : "" };
    setFilters(nextFilters);
    pushFilters(nextFilters);
  };

  const resetFilters = () => {
    const nextFilters = {
      year: "",
      category: "",
      country: "",
      movieType: "",
      status: "",
      quality: "",
      lang: "",
      sort_field: "year_latest",
    };
    setFilters(nextFilters);
    NProgress.start();
    router.push(`/${movieTypeSlug}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <BreadCrumb breadCrumb={breadCrumb} />
        <button
          aria-label="Mở lọc phim"
          onClick={() => setShowFilters((prev) => !prev)}
          className={`group flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black uppercase tracking-wide transition ${
            showFilters
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-700 hover:text-white"
          }`}
        >
          <AdjustmentsHorizontalIcon
            className={`size-5 transition-transform ${showFilters ? "rotate-90" : "group-hover:rotate-12"}`}
          />
          <span className="hidden sm:block">Bộ lọc</span>
        </button>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => removeFilter(key)}
              className="group inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:border-primary/50 hover:bg-primary/15"
            >
              {filterLabels[key]?.get(value) || value}
              <XMarkIcon className="size-3 transition group-hover:rotate-90" />
            </button>
          ))}
        </div>
      )}

      {showFilters && (
        <form
          className="relative z-20 overflow-visible rounded-[1.75rem] border border-zinc-800 bg-zinc-950/85 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            pushFilters();
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-[radial-gradient(circle_at_0%_0%,rgba(220,38,38,0.16),transparent_28%),radial-gradient(circle_at_100%_0%,rgba(250,204,21,0.08),transparent_26%)]" />
          <div className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SelectDropdown
              label="Loại phim"
              value={filters.movieType}
              options={withPlaceholder(
                "Tất cả loại phim",
                Object.values(typesMovie).map((type) => ({
                  value: type.slug,
                  label: type.name,
                })),
              )}
              open={openFilter === "movieType"}
              onToggle={() => setOpenFilter(openFilter === "movieType" ? null : "movieType")}
              onChange={(value) => setFilterValue("movieType", value)}
            />
            <SelectDropdown
              label="Thể loại"
              value={filters.category}
              options={withPlaceholder(
                "Tất cả thể loại",
                (categories || [])
                  .filter((category) => category.slug !== "phim-18")
                  .map((category) => ({
                    value: category.slug,
                    label: category.name,
                  })),
              )}
              open={openFilter === "category"}
              onToggle={() => setOpenFilter(openFilter === "category" ? null : "category")}
              onChange={(value) => setFilterValue("category", value)}
            />
            <SelectDropdown
              label="Quốc gia"
              value={filters.country}
              options={withPlaceholder(
                "Tất cả quốc gia",
                (countries || []).map((country) => ({
                  value: country.slug,
                  label: country.name,
                })),
              )}
              open={openFilter === "country"}
              onToggle={() => setOpenFilter(openFilter === "country" ? null : "country")}
              onChange={(value) => setFilterValue("country", value)}
            />
            <SelectDropdown
              label="Năm"
              value={filters.year}
              options={withPlaceholder("Tất cả năm", years)}
              open={openFilter === "year"}
              onToggle={() => setOpenFilter(openFilter === "year" ? null : "year")}
              onChange={(value) => setFilterValue("year", value)}
            />
            <SelectDropdown
              label="Trạng thái"
              value={filters.status}
              options={withPlaceholder("Tất cả trạng thái", STATUS_OPTIONS)}
              open={openFilter === "status"}
              onToggle={() => setOpenFilter(openFilter === "status" ? null : "status")}
              onChange={(value) => setFilterValue("status", value)}
            />
            <SelectDropdown
              label="Chất lượng"
              value={filters.quality}
              options={withPlaceholder("Tất cả chất lượng", QUALITY_OPTIONS)}
              open={openFilter === "quality"}
              onToggle={() => setOpenFilter(openFilter === "quality" ? null : "quality")}
              onChange={(value) => setFilterValue("quality", value)}
            />
            <SelectDropdown
              label="Ngôn ngữ"
              value={filters.lang}
              options={withPlaceholder("Tất cả ngôn ngữ", LANG_OPTIONS)}
              open={openFilter === "lang"}
              onToggle={() => setOpenFilter(openFilter === "lang" ? null : "lang")}
              onChange={(value) => setFilterValue("lang", value)}
            />
            <div className="lg:col-span-2">
              <SelectDropdown
                label="Sắp xếp"
                value={filters.sort_field}
                options={SORT_OPTIONS}
                open={openFilter === "sort_field"}
                onToggle={() => setOpenFilter(openFilter === "sort_field" ? null : "sort_field")}
                onChange={(value) => setFilterValue("sort_field", value)}
              />
            </div>
            <div className="flex items-end gap-2 lg:col-span-2">
              <button
                aria-label="Lọc phim"
                type="submit"
                className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-primary/90"
              >
                Áp dụng bộ lọc
              </button>
              <button
                aria-label="Đặt lại bộ lọc"
                type="button"
                onClick={resetFilters}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-300 transition hover:border-zinc-700 hover:text-white"
              >
                <ArrowPathIcon className="size-5" />
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default MovieFilter;





