"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CateCtr, Movie } from "@/lib/types";
import { getLocalHistory } from "@/lib/utils";
import { createSupabaseClient } from "@/lib/supabase/client";

interface BaseDataContextType {
  user: any;
  authLoading: boolean;
  categories: CateCtr[] | undefined;
  countries: CateCtr[] | undefined;
  topMovies: {
    year: Movie[];
    month: Movie[];
    day: Movie[];
  };
}

const BaseDataContext = createContext<BaseDataContextType | undefined>(
  undefined,
);

export default function BaseDataContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseClient();
  const queryClient = useQueryClient();

  // 1. TỐI ƯU AUTH: Dùng getSession để triệt tiêu request mạng dư thừa
  const { data: user, isLoading: authLoading } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      // getSession() lấy từ bộ nhớ cục bộ, không gửi request tới Supabase Auth Server
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.user ?? null;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // 2. Fetch Metadata
  const { data: metadata } = useQuery({
    queryKey: ["metadata"],
    queryFn: () => fetch("/api/metadata").then((res) => res.json()),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // 3. Fetch Top Movies (Cache 10 phút)
  const { data: dataTopMovies } = useQuery<Movie[]>({
    queryKey: ["topMovies"],
    queryFn: () => fetch("/api/movies/top").then((res) => res.json()),
    staleTime: 1000 * 60 * 10,
  });

  // 4. ĐỒNG BỘ LỊCH SỬ (Chỉ chạy khi User thực sự tồn tại)
  useEffect(() => {
    if (!user) return;

    const handleSync = async () => {
      const localData = getLocalHistory();
      if (localData.length === 0) return;

      try {
        const res = await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isSync: true, localHistory: localData }),
        });

        if (res.ok) {
          localStorage.removeItem("v_movie_guest_history");
          window.dispatchEvent(new Event("history-synced"));
          queryClient.invalidateQueries({
            queryKey: ["movie-history", user.id],
          });
          console.log("🚀 [Sync] Đồng bộ thành công!");
        }
      } catch (error) {
        console.error("❌ [Sync Error]", error);
      }
    };

    handleSync();
  }, [user, queryClient]);

  // 5. Lắng nghe Auth State để cập nhật Cache
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
          // Cập nhật trực tiếp dữ liệu vào cache thay vì fetch lại
          queryClient.setQueryData(["auth-user"], session?.user ?? null);
        }
      },
    );
    return () => authListener.subscription.unsubscribe();
  }, [supabase, queryClient]);

  // 6. TỐI ƯU RENDERING: Memoize dữ liệu đã xử lý
  const processedData = useMemo(() => {
    const cats = metadata?.categories ? [...metadata.categories] : undefined;
    const ctrs = metadata?.countries ? [...metadata.countries] : undefined;

    if (cats) {
      cats.pop();
      cats.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (ctrs) {
      ctrs.sort((a, b) => a.name.localeCompare(b.name));
    }

    const year = dataTopMovies?.slice(0, 10) || [];
    const month =
      dataTopMovies
        ?.slice(0, 14)
        .sort(() => 0.5 - Math.random())
        .slice(0, 10) || [];
    const day =
      dataTopMovies?.sort(() => 0.5 - Math.random()).slice(0, 10) || [];

    return { cats, ctrs, year, month, day };
  }, [metadata, dataTopMovies]);

  // 7. Memoize Context Value để tránh re-render rác cho cả App
  const contextValue = useMemo(
    () => ({
      user,
      authLoading,
      categories: processedData.cats,
      countries: processedData.ctrs,
      topMovies: {
        year: processedData.year,
        month: processedData.month,
        day: processedData.day,
      },
    }),
    [user, authLoading, processedData],
  );

  return (
    <BaseDataContext.Provider value={contextValue}>
      {children}
    </BaseDataContext.Provider>
  );
}

export const useData = () => {
  const context = useContext(BaseDataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
};
