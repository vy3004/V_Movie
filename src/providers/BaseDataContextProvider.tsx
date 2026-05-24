"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CateCtr,
  HistoryItem,
  Movie,
  PageMoviesData,
  SubscriptionItem,
  UserProfile,
} from "@/types";
import { getLocalHistory, getLocalSubscriptions } from "@/lib/utils";
import { createSupabaseClient } from "@/lib/supabase/client";
import { shouldSkipAuthRefresh } from "@/lib/public-routes";

// Chỉ lọc bỏ các nhãn thể loại nhạy cảm khỏi Menu/UI
const HIDDEN_GENRE_SLUGS = ["nguoi-lon", "xxx", "phim-sex"];

interface BaseDataContextType {
  user: UserProfile | null | undefined;
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
  const pathname = usePathname();
  const lastEventTime = useRef<number>(0);
  const syncedHistoryUserIdsRef = useRef<Set<string>>(new Set());
  const syncedSubscriptionUserIdsRef = useRef<Set<string>>(new Set());

  // 1. Auth User
  const { data: user, isLoading: authLoading } = useQuery<
    UserProfile | null | undefined
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

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 60,
  });

  const userProfile = useMemo(() => {
    // 1. Nếu đang load (undefined) hoặc chưa đăng nhập (null) -> Trả về luôn
    if (!user) return user;

    // 2. Nếu có user nhưng chưa có profile -> Trả về user
    if (!profile) return user as UserProfile;

    // 3. Có cả 2 -> Gộp lại
    return {
      ...user,
      ...profile,
    } as UserProfile;
  }, [user, profile]);

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
    staleTime: 1000 * 60 * 60 * 24, // 1 ngày
  });

  // 4. Đồng bộ Lịch sử & Theo dõi
  useEffect(() => {
    if (!user) return;

    const syncGuestHistory = async () => {
      if (syncedHistoryUserIdsRef.current.has(user.id)) return;

      const localHistory: HistoryItem[] = getLocalHistory();
      if (localHistory.length === 0) {
        syncedHistoryUserIdsRef.current.add(user.id);
        return;
      }

      syncedHistoryUserIdsRef.current.add(user.id);

      try {
        const res = await fetch("/api/history/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ localHistory }),
        });

        if (!res.ok) {
          syncedHistoryUserIdsRef.current.delete(user.id);
          return;
        }

        await queryClient.invalidateQueries({ queryKey: ["history-list", user.id] });
        localStorage.removeItem("v_movie_guest_history");
      } catch (error) {
        syncedHistoryUserIdsRef.current.delete(user.id);
        console.error("[Sync Error: /api/history/sync]", error);
      }
    };

    const syncGuestSubscriptions = async () => {
      if (syncedSubscriptionUserIdsRef.current.has(user.id)) return;

      const localSubscriptions: SubscriptionItem[] = getLocalSubscriptions();
      if (localSubscriptions.length === 0) {
        syncedSubscriptionUserIdsRef.current.add(user.id);
        return;
      }

      syncedSubscriptionUserIdsRef.current.add(user.id);

      try {
        const res = await fetch("/api/subscriptions/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ localSubscriptions }),
        });

        if (!res.ok) {
          syncedSubscriptionUserIdsRef.current.delete(user.id);
          return;
        }

        await queryClient.invalidateQueries({
          queryKey: ["subscriptions-list", user.id],
        });
        localStorage.removeItem("v_movie_guest_subscriptions");
      } catch (error) {
        syncedSubscriptionUserIdsRef.current.delete(user.id);
        console.error("[Sync Error: /api/subscriptions/sync]", error);
      }
    };

    void syncGuestHistory();
    void syncGuestSubscriptions();
  }, [user, queryClient]);

  const shouldRefreshOnAuthChange = useMemo(
    () => !shouldSkipAuthRefresh(pathname),
    [pathname],
  );

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

          if (!previousUser && shouldRefreshOnAuthChange) router.refresh();
        }

        if (event === "SIGNED_OUT") {
          queryClient.setQueryData(["auth-user"], null);
          syncedHistoryUserIdsRef.current.clear();
          syncedSubscriptionUserIdsRef.current.clear();

          // Xóa cache các query liên quan đến người dùng cũ
          queryClient.removeQueries({ queryKey: ["history-list"] });
          queryClient.removeQueries({ queryKey: ["history-stats"] });
          queryClient.removeQueries({ queryKey: ["subscriptions-list"] });
          queryClient.removeQueries({ queryKey: ["subscriptions-stats"] });

          if (previousUser && shouldRefreshOnAuthChange) router.refresh();
        }
        if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          queryClient.setQueryData(["auth-user"], currentUser);
        }
      },
    );

    return () => authListener.subscription.unsubscribe();
  }, [supabase, queryClient, router, shouldRefreshOnAuthChange]);

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
      user: userProfile,
      authLoading,
      categories: processedData.cats,
      countries: processedData.ctrs,
      topMovies: {
        year: processedData.year,
        month: processedData.month,
        day: processedData.day,
      },
    }),
    [userProfile, authLoading, processedData],
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
