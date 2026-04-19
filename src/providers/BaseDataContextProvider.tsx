"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CateCtr,
  HistoryItem,
  Movie,
  PageMoviesData,
  SubscriptionItem,
} from "@/types";
import { getLocalHistory, getLocalSubscriptions } from "@/lib/utils";
import { createSupabaseClient } from "@/lib/supabase/client";

// Chỉ lọc bỏ các nhãn thể loại nhạy cảm khỏi Menu/UI
const HIDDEN_GENRE_SLUGS = ["phim-18", "nguoi-lon", "xxx", "phim-sex"];

interface BaseDataContextType {
  user: User | null | undefined;
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
  const router = useRouter();
  const lastEventTime = useRef<number>(0);

  // 1. Auth User
  const { data: user, isLoading: authLoading } = useQuery<
    User | null | undefined
  >({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.user ?? null;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // 2. Metadata: Lấy Thể loại & Quốc gia
  const { data: metadata } = useQuery({
    queryKey: ["metadata"],
    queryFn: () => fetch("/api/metadata").then((res) => res.json()),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // 3. Top Movies: Lấy danh sách phim hot
  const { data: responseTopMovies } = useQuery<PageMoviesData>({
    queryKey: ["topMovies"],
    queryFn: async () => {
      const res = await fetch(
        "/api/movies/list?limit=20&sort_field=tmdb.vote_count",
      );
      if (!res.ok) throw new Error("Failed to fetch movies");
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  // 4. Đồng bộ Lịch sử & Theo dõi
  useEffect(() => {
    if (!user) return;
    const handleSync = async (
      url: string,
      localData: HistoryItem[] | SubscriptionItem[],
      storageKey: string,
      queryKey: string[],
    ) => {
      if (localData.length === 0) return;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [storageKey === "v_movie_guest_history"
              ? "localHistory"
              : "localSubscriptions"]: localData,
          }),
        });
        if (res.ok) {
          localStorage.removeItem(storageKey);
          if (storageKey === "v_movie_guest_history")
            window.dispatchEvent(new Event("history-synced"));
          queryClient.invalidateQueries({ queryKey });
        }
      } catch (error) {
        console.error(`❌ [Sync Error: ${url}]`, error);
      }
    };
    handleSync(
      "/api/history/sync",
      getLocalHistory(),
      "v_movie_guest_history",
      ["movie-history", user.id],
    );
    handleSync(
      "/api/subscriptions/sync",
      getLocalSubscriptions(),
      "v_movie_guest_subscriptions",
      ["subscriptions-list", user.id],
    );
  }, [user, queryClient]);

  // 5. Auth Listener
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const now = Date.now();
        if (now - lastEventTime.current < 500) return;
        lastEventTime.current = now;
        const currentUser = session?.user ?? null;
        const previousUser = queryClient.getQueryData(["auth-user"]);

        if (event === "SIGNED_IN") {
          queryClient.setQueryData(["auth-user"], currentUser);
          if (!previousUser) router.refresh();
        }
        if (event === "SIGNED_OUT") {
          queryClient.setQueryData(["auth-user"], null);
          queryClient.removeQueries({ queryKey: ["movie-history"] });
          if (previousUser) router.refresh();
        }
        if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          queryClient.setQueryData(["auth-user"], currentUser);
        }
      },
    );
    return () => authListener.subscription.unsubscribe();
  }, [supabase, queryClient, router]);

  // 6. Xử lý dữ liệu (Chỉ lọc ở tầng Category)
  const processedData = useMemo(() => {
    // A. Lọc bỏ các thể loại nhạy cảm khỏi danh sách hiển thị (Navbar/Sidebar)
    const cats = metadata?.categories
      ? metadata.categories
          .filter((c: CateCtr) => !HIDDEN_GENRE_SLUGS.includes(c.slug))
          .sort((a: CateCtr, b: CateCtr) => a.name.localeCompare(b.name))
      : undefined;

    const ctrs = metadata?.countries
      ? [...metadata.countries].sort((a: CateCtr, b: CateCtr) =>
          a.name.localeCompare(b.name),
        )
      : undefined;

    // B. Top Movies: Lấy nguyên bản từ API (Không lọc phim bên trong)
    const items: Movie[] = responseTopMovies?.items || [];

    const year = items.slice(0, 10);
    const month = [...items].sort(() => 0.5 - Math.random()).slice(0, 10);
    const day = [...items].sort(() => 0.5 - Math.random()).slice(0, 10);

    return { cats, ctrs, year, month, day };
  }, [metadata, responseTopMovies]);

  // 7. Context Value
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
