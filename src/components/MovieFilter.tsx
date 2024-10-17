"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/solid";

import BreadCrumb from "@/components/BreadCrumb";

import { useData } from "@/providers/BaseDataContextProvider";
import { BreadCrumb as BreadCrumbType } from "@/lib/types";
import { typesMovie } from "@/lib/configs";

interface SelectInputProps {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}

const SelectInput = ({
  name,
  value,
  onChange,
  options,
  placeholder,
}: SelectInputProps) => (
  <select
    name={name}
    value={value}
    onChange={onChange}
    className="px-3 py-2.5 bg-secondary rounded"
  >
    <option value="">{placeholder}</option>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

interface MovieFilterProps {
  breadCrumb: BreadCrumbType[];
}

const MovieFilter = ({ breadCrumb }: MovieFilterProps) => {
  const router = useRouter();
  const { categories, countries } = useData();

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    year: "",
    category: "",
    country: "",
    movieType: "",
  });

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleFilter = () => {
    const query = new URLSearchParams();
    const type = filters.movieType || "";

    if (filters.year) query.append("year", filters.year);
    if (filters.category) query.append("category", filters.category);
    if (filters.country) query.append("country", filters.country);

    router.push(`${type}?${query.toString()}`);
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <BreadCrumb breadCrumb={breadCrumb} />
        <button
          onClick={() => setShowFilters((prev) => !prev)}
          className={`flex items-center hover:text-primary ${
            showFilters ? "text-primary" : ""
          }`}
        >
          <AdjustmentsHorizontalIcon
            className={`size-6 mr-1 ${showFilters ? "rotate-90" : ""}`}
          />
          Lọc phim
        </button>
      </div>

      {showFilters && (
        <form className="flex items-center justify-between bg-gray-800 p-4 rounded">
          <SelectInput
            name="movieType"
            value={filters.movieType}
            onChange={handleFilterChange}
            options={Object.values(typesMovie).map((type) => ({
              value: type.slug,
              label: type.name,
            }))}
            placeholder="Chọn loại phim"
          />

          {categories && (
            <SelectInput
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              options={categories.map((category) => ({
                value: category.slug,
                label: category.name,
              }))}
              placeholder="Chọn thể loại"
            />
          )}

          {countries && (
            <SelectInput
              name="country"
              value={filters.country}
              onChange={handleFilterChange}
              options={countries.map((country) => ({
                value: country.slug,
                label: country.name,
              }))}
              placeholder="Chọn quốc gia"
            />
          )}

          <input
            type="text"
            name="year"
            value={filters.year}
            onChange={handleFilterChange}
            placeholder="Nhập năm"
            className="px-3 py-2 bg-secondary rounded"
          />

          <button
            type="button"
            onClick={handleFilter}
            className="px-4 py-2 bg-primary rounded"
          >
            Lọc phim
          </button>
        </form>
      )}
    </>
  );
};

export default MovieFilter;
