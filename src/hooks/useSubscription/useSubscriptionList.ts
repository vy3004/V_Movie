"use client";

import { useEffect } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { useData } from "@/providers/BaseDataContextProvider";
import { getLocalSubscriptions } from "@/lib/utils";

interface UseSubscriptionListProps {
  limit?: number;
  filter?: "all" | "new";
  keyword?: string;
  withStats?: boolean;
}

export function useSubscriptionList({
  limit = 15,
  filter = "all",
  keyword = "",
  withStats = false,
}: UseSubscriptionListProps = {}) {
  const { user, authLoading } = useData();
  const queryClient = useQueryClient();

  // 1. QUERY DANH SÁCH (INFINITE SCROLL)
  const listQuery = useInfiniteQuery({
    queryKey: ["subscriptions-list", user?.id || "guest", filter, keyword],
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      // Trường hợp khách (Guest)
      if (!user) {
        let local = getLocalSubscriptions();
        if (filter === "new") local = local.filter((s) => s.has_new_episode);
        if (keyword) {
          local = local.filter((s) =>
            s.movie_name.toLowerCase().includes(keyword.toLowerCase()),
          );
        }

        const start = (pageParam - 1) * limit;
        const end = start + limit;
        return {
          data: local.slice(start, end),
          nextCursor: end < local.length ? pageParam + 1 : null,
        };
      }

      // Trường hợp đã đăng nhập (Gọi API phân trang)
      const url = new URL("/api/subscriptions", window.location.origin);
      url.searchParams.set("userId", user.id);
      url.searchParams.set("page", pageParam.toString());
      url.searchParams.set("limit", limit.toString());
      url.searchParams.set("filter", filter);
      if (keyword) url.searchParams.set("keyword", keyword);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Network error");
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    enabled: !authLoading,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // 2. QUERY THỐNG KÊ (STATS TỪ REDIS)
  const statsQuery = useQuery({
    queryKey: ["subscriptions-stats", user?.id || "guest"],
    queryFn: async () => {
      if (!user) {
        const local = getLocalSubscriptions();
        return {
          total: local.length,
          hasNewCount: local.filter((s) => s.has_new_episode).length,
        };
      }
      const res = await fetch(`/api/subscriptions/stats?userId=${user.id}`);
      if (!res.ok) return { total: 0, hasNewCount: 0 };
      return res.json();
    },
    enabled: !authLoading && withStats,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // Lắng nghe sự kiện để làm mới dữ liệu toàn cục
  useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions-list"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions-stats"] });
    };

    window.addEventListener("subscription-updated", handleRefresh);
    return () =>
      window.removeEventListener("subscription-updated", handleRefresh);
  }, [queryClient]);

  const subscriptions = listQuery.data?.pages.flatMap((p) => p.data) || [];

  return {
    subscriptions,
    total: statsQuery.data?.total || 0,
    hasNewCount: statsQuery.data?.hasNewCount || 0,
    isLoading: listQuery.isLoading || statsQuery.isLoading,
    hasNextPage: listQuery.hasNextPage,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    fetchNextPage: listQuery.fetchNextPage,
    isError: listQuery.isError || statsQuery.isError,
  };
}
