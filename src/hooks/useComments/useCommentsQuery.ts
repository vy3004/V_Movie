"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { CommentItem } from "@/lib/types";
import { toast } from "sonner";

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
  const isManualRef = useRef(false);

  const queryKey = useMemo(
    () => ["comments", movieSlug, parentId],
    [movieSlug, parentId],
  );

  const {
    data: lineageData,
    isLoading: isTargetLoading,
    isFetched: isLineageFetched,
  } = useThreadLineageQuery(parentId === null ? movieSlug : "");

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
      if (parentId) url.searchParams.append("parentId", parentId);
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
      (!targetId || parentId !== null || isLineageFetched),
    staleTime: 1000 * 60 * 5,
  });

  const allComments = useMemo(() => {
    const list = queryResult.data?.pages.flatMap((page) => page.items) || [];
    if (pathIds.length > 0 && parentId === null) {
      return list.filter((c) => c.id !== pathIds[0]);
    }
    return list;
  }, [queryResult.data, pathIds, parentId]);

  const refresh = useCallback(async () => {
    isManualRef.current = true;
    await queryClient.invalidateQueries({
      queryKey: ["comments", movieSlug],
      exact: false,
    });
    toast.success("Đã làm mới bình luận");
  }, [movieSlug, queryClient]);

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
