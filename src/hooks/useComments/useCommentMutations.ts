"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { AddCommentPayload, CommentItem } from "@/types";
import { useAuthModal } from "@/providers/AuthModalProvider";
import { InfiniteComments } from "./useCommentsQuery";

interface MutationProps {
  movieSlug: string;
  parentId?: string | null;
  user?: User | null;
}

export function useCommentMutations({
  movieSlug,
  parentId = null,
  user,
}: MutationProps) {
  const queryClient = useQueryClient();
  const { onOpen } = useAuthModal();

  // Ép kiểu an toàn cho Cache Key
  const safeParentId = parentId || null;
  const currentQueryKey = ["comments", movieSlug, safeParentId];

  const checkAuth = useCallback(() => {
    if (!user) {
      toast.error("Vui lòng đăng nhập!");
      onOpen();
      return false;
    }
    return true;
  }, [user, onOpen]);

  const updateParentReplyCount = useCallback(
    (targetParentId: string, diff: number) => {
      queryClient.setQueriesData<InfiniteComments>(
        { queryKey: ["comments", movieSlug], exact: false },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === targetParentId
                  ? {
                      ...item,
                      replies_count: Math.max(0, item.replies_count + diff),
                    }
                  : item,
              ),
            })),
          };
        },
      );

      queryClient.setQueriesData<CommentItem[]>(
        { queryKey: ["comment-lineage"], exact: false },
        (old) => {
          if (!old) return old;
          return old.map((item) =>
            item.id === targetParentId
              ? {
                  ...item,
                  replies_count: Math.max(0, item.replies_count + diff),
                }
              : item,
          );
        },
      );
    },
    [queryClient, movieSlug],
  );

  // 1. ADD
  const addCommentMutation = useMutation({
    mutationFn: async ({
      content,
      movieName,
      replyToId,
      rootId,
    }: AddCommentPayload) => {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieSlug,
          movieName,
          content,
          parentId: safeParentId,
          replyToId,
          rootId,
        }),
      });
      if (!res.ok) throw new Error("Server error");
      return res.json().then((d) => d.comment as CommentItem);
    },
    onMutate: async ({ content }) => {
      await queryClient.cancelQueries({ queryKey: currentQueryKey });
      const previousData =
        queryClient.getQueryData<InfiniteComments>(currentQueryKey);
      const fakeId = `temp-${crypto.randomUUID()}`;

      const fakeComment: CommentItem = {
        id: fakeId,
        movie_slug: movieSlug,
        user_id: user?.id || "temp-user",
        parent_id: safeParentId,
        content,
        likes_count: 0,
        replies_count: 0,
        is_liked_by_me: false,
        is_edited: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profiles: {
          full_name: user?.user_metadata?.full_name || "Bạn",
          avatar_url: user?.user_metadata?.avatar_url || "",
        },
        isOptimistic: true,
      };

      queryClient.setQueryData<InfiniteComments>(currentQueryKey, (old) => {
        if (!old)
          return {
            pages: [{ items: [fakeComment], total: 1 }],
            pageParams: [null],
          };
        const newPages = [...old.pages];
        newPages[0] = {
          ...newPages[0],
          items: safeParentId
            ? [...newPages[0].items, fakeComment]
            : [fakeComment, ...newPages[0].items],
          total: (newPages[0].total || 0) + 1,
        };
        return { ...old, pages: newPages };
      });

      if (safeParentId) updateParentReplyCount(safeParentId, 1);
      return { previousData, fakeId };
    },
    onSuccess: (newComment, _vars, context) => {
      if (!newComment?.id && context?.previousData) {
        queryClient.setQueryData(currentQueryKey, context.previousData);
        return;
      }
      queryClient.setQueryData<InfiniteComments>(currentQueryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === context?.fakeId ? newComment : item,
            ),
          })),
        };
      });
    },
    onError: (_err, _vars, context) => {
      // FIX LỖI CACHE TREO: Nếu chưa từng có data, xóa luôn cache thay vì để lại Comment Ảo
      if (context?.previousData) {
        queryClient.setQueryData(currentQueryKey, context.previousData);
      } else {
        queryClient.setQueryData(currentQueryKey, {
          pages: [],
          pageParams: [],
        });
      }
      if (safeParentId) updateParentReplyCount(safeParentId, -1);
      toast.error("Không thể gửi bình luận.");
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: currentQueryKey }),
  });

  // 2. DELETE
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(
        `/api/comments?id=${commentId}&movieSlug=${movieSlug}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ["comments", movieSlug] });
      const previousQueries = queryClient.getQueriesData<InfiniteComments>({
        queryKey: ["comments", movieSlug],
      });

      queryClient.setQueriesData<InfiniteComments>(
        { queryKey: ["comments", movieSlug] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((c) => c.id !== commentId),
              total: page.items.some((c) => c.id === commentId)
                ? Math.max(0, (page.total || 0) - 1)
                : page.total,
            })),
          };
        },
      );

      queryClient.setQueriesData<CommentItem[]>(
        { queryKey: ["comment-lineage"], exact: false },
        (old) => {
          if (!old) return old;
          return old.filter((item) => item.id !== commentId);
        },
      );

      if (safeParentId) updateParentReplyCount(safeParentId, -1);
      return { previousQueries };
    },
    onError: (_err, _commentId, context) => {
      // FIX LỖI UNDEFINED ROLLBACK
      if (context?.previousQueries) {
        context.previousQueries.forEach(([key, data]) => {
          if (data !== undefined) queryClient.setQueryData(key, data);
        });
      }
      toast.error("Không thể xóa bình luận.");
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["comments", movieSlug] }),
  });

  // 3. TOGGLE LIKE
  const toggleLikeMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch("/api/comments/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, movieSlug }),
      });
      if (!res.ok) throw new Error("Like toggle failed");
      return res.json();
    },
    onMutate: async (commentId) => {
      const filter = { queryKey: ["comments", movieSlug] };
      await queryClient.cancelQueries(filter);
      await queryClient.cancelQueries({ queryKey: ["comment-lineage"] });

      const previousComments =
        queryClient.getQueriesData<InfiniteComments>(filter);
      const previousLineage = queryClient.getQueriesData<CommentItem[]>({
        queryKey: ["comment-lineage"],
      });

      const updater = (oldItems: CommentItem[]) =>
        oldItems.map((c) => {
          if (c.id === commentId) {
            const wasLiked = c.is_liked_by_me;
            return {
              ...c,
              is_liked_by_me: !wasLiked,
              likes_count: wasLiked
                ? Math.max(0, c.likes_count - 1)
                : c.likes_count + 1,
            };
          }
          return c;
        });

      queryClient.setQueriesData<InfiniteComments>(filter, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: updater(page.items),
          })),
        };
      });

      queryClient.setQueriesData<CommentItem[]>(
        { queryKey: ["comment-lineage"], exact: false },
        (old) => (old ? updater(old) : old),
      );

      return { previousComments, previousLineage };
    },
    onError: (_err, _commentId, context) => {
      // FIX LỖI UNDEFINED ROLLBACK
      if (context?.previousComments) {
        context.previousComments.forEach(([key, data]) => {
          if (data !== undefined) queryClient.setQueryData(key, data);
        });
      }
      if (context?.previousLineage) {
        context.previousLineage.forEach(([key, data]) => {
          if (data !== undefined) queryClient.setQueryData(key, data);
        });
      }
      toast.error("Không thể thực hiện thao tác.");
    },
  });

  return {
    addComment: (
      content: string,
      movieName?: string,
      replyToId?: string,
      rootId?: string | null,
    ) => {
      if (checkAuth())
        return addCommentMutation.mutateAsync({
          movieSlug,
          content,
          movieName,
          replyToId,
          rootId,
        });
    },
    deleteComment: (id: string) => {
      if (checkAuth()) return deleteCommentMutation.mutateAsync(id);
    },
    toggleLike: (id: string) => {
      if (checkAuth()) return toggleLikeMutation.mutate(id);
    },
    isAdding: addCommentMutation.isPending,
    isDeleting: deleteCommentMutation.isPending,
  };
}
