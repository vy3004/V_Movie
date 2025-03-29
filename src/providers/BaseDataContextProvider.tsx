"use client";

import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchCategories, fetchCountries, fetchMovies } from "@/lib/apiClient";
import { CateCtr, Movie } from "@/lib/types";
import { typesMovie } from "@/lib/configs";

interface BaseDataContextType {
  categories: CateCtr[] | undefined;
  countries: CateCtr[] | undefined;
  topMovies: {
    year: Movie[];
    month: Movie[];
    day: Movie[];
  };
}

const BaseDataContext = createContext<BaseDataContextType | undefined>(
  undefined
);

export default function BaseDataContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: categories } = useQuery<CateCtr[]>({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const { data: countries } = useQuery<CateCtr[]>({
    queryKey: ["countries"],
    queryFn: fetchCountries,
  });

  const { data: dataTopMovies } = useQuery<Movie[]>({
    queryKey: ["topMovies"],
    queryFn: async () =>
      (
        await fetchMovies(typesMovie.NEW.slug, {
          sort_field: "view",
        })
      ).items,
  });

  categories?.pop();

  categories?.sort((a, b) => a.name.localeCompare(b.name));
  countries?.sort((a, b) => a.name.localeCompare(b.name));

  const year = dataTopMovies?.slice(0, 10) || [];
  const month =
    dataTopMovies
      ?.slice(0, 14)
      .sort(() => 0.5 - Math.random())
      .slice(0, 10) || [];
  const day = dataTopMovies?.sort(() => 0.5 - Math.random()).slice(0, 10) || [];

  return (
    <BaseDataContext.Provider
      value={{ categories, countries, topMovies: { year, month, day } }}
    >
      {children}
    </BaseDataContext.Provider>
  );
}

export const useData = () => {
  const context = useContext(BaseDataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
