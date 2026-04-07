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
import { CateCtr, Movie } from "@/lib/types";
import { getLocalHistory } from "@/lib/utils";
import { createSupabaseClient } from "@/lib/supabase/client";

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

  // 1. Auth User: Cache vô hạn vì sẽ cập nhật chủ động qua onAuthStateChange
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

  // 2. Metadata (Categories/Countries): Backend đã có Cache-Control 1h
  const { data: metadata } = useQuery({
    queryKey: ["metadata"],
    queryFn: () => fetch("/api/metadata").then((res) => res.json()),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // 3. Top Movies: Backend có Redis cache 10p
  const { data: dataTopMovies } = useQuery<Movie[]>({
    queryKey: ["topMovies"],
    queryFn: () => fetch("/api/movies/top").then((res) => res.json()),
    staleTime: 1000 * 60 * 10, // 10p khớp với Redis
  });

  // 4. Đồng bộ lịch sử (Optimized for Redis)
  useEffect(() => {
    if (!user) return;

    const handleSync = async () => {
      const localData = getLocalHistory();
      if (localData.length === 0) return;

      try {
        const res = await fetch("/api/history/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ localHistory: localData }),
        });

        if (res.ok) {
          localStorage.removeItem("v_movie_guest_history");
          window.dispatchEvent(new Event("history-synced"));

          // Ta invalidate để React Query fetch lại bản mới nhất từ DB
          queryClient.invalidateQueries({
            queryKey: ["movie-history", user.id],
          });
          console.log(
            "🚀 [Redis-Sync] Lịch sử đã được đồng bộ và làm mới cache.",
          );
        }
      } catch (error) {
        console.error("❌ [Sync Error]", error);
      }
    };

    handleSync();
  }, [user, queryClient]);

  // 5. Auth Listener (Tối ưu tránh Duplicate & Flash UI)
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
          if (!previousUser) {
            router.refresh();
          }
        }

        if (event === "SIGNED_OUT") {
          queryClient.setQueryData(["auth-user"], null);
          queryClient.removeQueries({ queryKey: ["movie-history"] });
          if (previousUser) {
            router.refresh();
          }
        }

        // TOKEN_REFRESHED và USER_UPDATED:
        if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          queryClient.setQueryData(["auth-user"], currentUser);
        }
      },
    );
    return () => authListener.subscription.unsubscribe();
  }, [supabase, queryClient, router]);

  // 6. Xử lý dữ liệu thô (Memoized)
  const processedData = useMemo(() => {
    const cats = metadata?.categories ? [...metadata.categories] : undefined;
    const ctrs = metadata?.countries ? [...metadata.countries] : undefined;

    if (cats) {
      cats.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (ctrs) {
      ctrs.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Top Movies Logic
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

  // 7. Context Value (Memoized)
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
