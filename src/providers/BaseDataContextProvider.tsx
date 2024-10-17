"use client";

import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchCategories, fetchCountries } from "@/lib/apiClient";
import { CateCtr } from "@/lib/types";

interface BaseDataContextType {
  categories: CateCtr[] | undefined;
  countries: CateCtr[] | undefined;
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

  categories?.pop();

  categories?.sort((a, b) => a.name.localeCompare(b.name));
  countries?.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <BaseDataContext.Provider value={{ categories, countries }}>
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
