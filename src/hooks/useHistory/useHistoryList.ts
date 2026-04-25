"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { getLocalHistory } from "@/lib/utils";
import { useData } from "@/providers/BaseDataContextProvider";

interface UseHistoryListProps {
  limit?: number;
  filter?: "all" | "watching" | "finished";
  keyword?: string;
  withStats?: boolean;
}

export function useHistoryList({
  limit = 12,
  filter = "all",
  keyword = "",
  withStats = false,
}: UseHistoryListProps = {}) {
  const queryClient = useQueryClient();
  const { user, authLoading } = useData();

  // 1. QUERY: LẤY DANH SÁCH (INFINITE SCROLL)
  const query = useInfiniteQuery({
    queryKey: ["history-list", user?.id, limit, filter, keyword],
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      if (user) {
        const url = new URL("/api/history/list", window.location.origin);
        url.searchParams.set("userId", user.id);
        url.searchParams.set("limit", limit.toString());
        url.searchParams.set("page", pageParam.toString());
        url.searchParams.set("filter", filter);
        if (keyword) url.searchParams.set("keyword", keyword);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Network error");
        return await res.json();
      }

      // Logic cho Guest (Local)
      let local = getLocalHistory();
      if (filter === "watching") local = local.filter((i) => !i.is_finished);
      if (filter === "finished") local = local.filter((i) => i.is_finished);
      if (keyword)
        local = local.filter((i) =>
          i.movie_name.toLowerCase().includes(keyword.toLowerCase()),
        );
      const start = (pageParam - 1) * limit;
      const end = start + limit;
      return {
        data: local.slice(start, end),
        nextCursor: end < local.length ? pageParam + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    enabled: !authLoading,
    staleTime: 1000 * 60 * 3,
    refetchOnWindowFocus: false,
  });

  // 2. QUERY: LẤY THỐNG KÊ TỪ REDIS
  const statsQuery = useQuery({
    queryKey: ["history-stats", user?.id],
    queryFn: async () => {
      if (!user) {
        const local = getLocalHistory();
        const fin = local.filter((i) => i.is_finished).length;
        return {
          total: local.length,
          watching: local.length - fin,
          finished: fin,
        };
      }
      const res = await fetch(`/api/history/stats?userId=${user.id}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch stats: ${res.status}`);
      }
      return await res.json();
    },
    enabled: !authLoading && withStats,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // 3. MUTATIONS (XÓA)
  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`/api/history?movieSlug=${slug}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Failed to delete: ${res.status}`);
      }
    },
    onSuccess: () => {
      toast.success("Đã xóa khỏi lịch sử");
      queryClient.invalidateQueries({ queryKey: ["history-list"] });
      queryClient.invalidateQueries({ queryKey: ["history-stats"] });
    },
    onError: () => {
      toast.error("Xóa thất bại, vui lòng thử lại");
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/history`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`Failed to clear history: ${res.status}`);
      }
    },
    onSuccess: () => {
      toast.success("Đã xóa toàn bộ lịch sử");
      queryClient.invalidateQueries({ queryKey: ["history-list"] });
      queryClient.invalidateQueries({ queryKey: ["history-stats"] });
    },
    onError: () => {
      toast.error("Xóa thất bại, vui lòng thử lại");
    },
  });

  return {
    historyList: query.data?.pages.flatMap((p) => p.data) || [],
    stats: statsQuery.data || { total: 0, watching: 0, finished: 0 },
    authLoading,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    deleteItem: deleteMutation.mutate,
    clearAll: clearAllMutation.mutate,
  };
}
