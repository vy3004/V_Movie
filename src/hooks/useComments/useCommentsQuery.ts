"use client";

import { useCallback, useMemo } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { CommentItem } from "@/types";

const PAGINATION_LIMIT = 5;

export interface CommentResponse {
  items: CommentItem[];
  total: number;
}
export type InfiniteComments = InfiniteData<CommentResponse>;

// 1. HOOK LẤY GIA PHẢ
export function useThreadLineageQuery(movieSlug: string) {
  const searchParams = useSearchParams();
  const targetId = searchParams.get("commentId");

  return useQuery({
    queryKey: ["comment-lineage", targetId, movieSlug],
    queryFn: async () => {
      if (!targetId) return [];
      const res = await fetch(
        `/api/comments/thread?id=${targetId}&movieSlug=${movieSlug}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<CommentItem[]>;
    },
    enabled: !!targetId && !!movieSlug,
    staleTime: 1000 * 60 * 5,
  });
}

// 2. HOOK LẤY DANH SÁCH CHÍNH
export function useCommentsQuery({
  movieSlug,
  parentId = null,
  enabled = true,
}: {
  movieSlug: string;
  parentId?: string | null;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const targetId = searchParams.get("commentId");

  // Chuẩn hóa Key: Phải ép về null nếu undefined để tránh tạo 2 cache rác
  const safeParentId = parentId || null;
  const queryKey = useMemo(
    () => ["comments", movieSlug, safeParentId],
    [movieSlug, safeParentId],
  );

  const {
    data: lineageData,
    isLoading: isTargetLoading,
    isFetched: isLineageFetched,
  } = useThreadLineageQuery(safeParentId === null ? movieSlug : "");

  // Mảng các ID đã hiện ở Cây gia phả
  const pathIds = useMemo(
    () => lineageData?.map((c) => c.id) || [],
    [lineageData],
  );

  const queryResult = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const url = new URL("/api/comments", window.location.origin);
      url.searchParams.append("movieSlug", movieSlug);
      url.searchParams.append("limit", PAGINATION_LIMIT.toString());
      if (safeParentId) url.searchParams.append("parentId", safeParentId);
      if (pageParam) url.searchParams.append("cursor", pageParam as string);

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<CommentResponse>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.items || lastPage.items.length < PAGINATION_LIMIT)
        return undefined;
      return lastPage.items[lastPage.items.length - 1].created_at;
    },
    enabled:
      enabled &&
      !!movieSlug &&
      (!targetId || safeParentId !== null || isLineageFetched),
    staleTime: 1000 * 60 * 5,
  });

  // KHỬ TRÙNG LẶP TUYỆT ĐỐI BẰNG SET O(1)
  const allComments = useMemo(() => {
    const list = queryResult.data?.pages.flatMap((page) => page.items) || [];

    if (pathIds.length > 0 && safeParentId === null) {
      const lineageSet = new Set(pathIds);
      // Chặn TẤT CẢ các comment đã có mặt trong gia phả khỏi danh sách chính
      return list.filter((c) => !lineageSet.has(c.id));
    }
    return list;
  }, [queryResult.data, pathIds, safeParentId]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["comments", movieSlug],
      exact: false,
    });
    if (targetId) {
      await queryClient.invalidateQueries({
        queryKey: ["comment-lineage", targetId, movieSlug],
      });
    }
    toast.success("Đã làm mới bình luận");
  }, [movieSlug, queryClient, targetId]);

  return {
    ...queryResult,
    comments: allComments,
    totalCount: queryResult.data?.pages[0]?.total || 0,
    pathIds,
    lineageData: lineageData || [],
    targetComment: lineageData?.[0] || null,
    isTargetLoading,
    isListFetched: queryResult.isFetched,
    loadMore: queryResult.fetchNextPage,
    refresh,
  };
}
