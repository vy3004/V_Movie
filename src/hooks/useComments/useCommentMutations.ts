"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { CommentItem } from "@/lib/types";
import { useAuthModal } from "@/providers/AuthModalProvider";
import { InfiniteComments } from "./useCommentsQuery";

interface MutationProps {
  movieSlug: string;
  parentId?: string | null;
  user?: User | null;
}

interface AddCommentVariables {
  content: string;
  movieName?: string;
  replyToId?: string;
  rootId?: string | null;
}

export function useCommentMutations({
  movieSlug,
  parentId = null,
  user,
}: MutationProps) {
  const queryClient = useQueryClient();
  const { onOpen } = useAuthModal();
  const currentQueryKey = ["comments", movieSlug, parentId];

  const checkAuth = useCallback(() => {
    if (!user) {
      toast.error("Vui lòng đăng nhập!");
      onOpen();
      return false;
    }
    return true;
  }, [user, onOpen]);

  // Cập nhật số lượng phản hồi đồng thời ở cả List chính và Cây gia phả
  const updateParentReplyCount = useCallback(
    (targetParentId: string, diff: number) => {
      // 1. Cập nhật trong danh sách bình luận (Infinite Query)
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

      // 2. Cập nhật trong cây gia phả (Tagged Section)
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

  // ===============================================
  // 1. MUTATION: THÊM BÌNH LUẬN
  // ===============================================
  const addCommentMutation = useMutation({
    mutationFn: async ({
      content,
      movieName,
      replyToId,
      rootId,
    }: AddCommentVariables) => {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieSlug,
          movieName,
          content,
          parentId,
          replyToId,
          rootId,
        }),
      });
      if (!res.ok) throw new Error("Server error");
      return res.json() as Promise<CommentItem>;
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
        parent_id: parentId,
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
      } as CommentItem;

      queryClient.setQueryData<InfiniteComments>(currentQueryKey, (old) => {
        if (!old)
          return {
            pages: [{ items: [fakeComment], total: 1 }],
            pageParams: [null],
          };
        const newPages = [...old.pages];
        newPages[0] = {
          ...newPages[0],
          items: parentId
            ? [...newPages[0].items, fakeComment]
            : [fakeComment, ...newPages[0].items],
          total: (newPages[0].total || 0) + 1,
        };
        return { ...old, pages: newPages };
      });

      if (parentId) updateParentReplyCount(parentId, 1);
      return { previousData, fakeId };
    },
    onSuccess: (newComment, variables, context) => {
      // Thay thế comment ảo bằng dữ liệu thật từ Server để tránh lỗi Reload trang
      if (!newComment?.id) {
        // Rollback nếu server không trả về comment hợp lệ
        if (context?.previousData) {
          queryClient.setQueryData(currentQueryKey, context.previousData);
        }
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
      if (context?.previousData)
        queryClient.setQueryData(currentQueryKey, context.previousData);
      toast.error("Không thể gửi bình luận.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: currentQueryKey });
    },
  });

  // ===============================================
  // 2. MUTATION: XÓA BÌNH LUẬN
  // ===============================================
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(
        `/api/comments?id=${commentId}&movieSlug=${movieSlug}`,
        {
          method: "DELETE",
        },
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

      // Xóa trong gia phả
      queryClient.setQueriesData<CommentItem[]>(
        { queryKey: ["comment-lineage"], exact: false },
        (old) => {
          if (!old) return old;
          return old.filter((item) => item.id !== commentId);
        },
      );

      if (parentId) updateParentReplyCount(parentId, -1);
      return { previousQueries };
    },
    onError: (_err, _commentId, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      toast.error("Không thể xóa bình luận.");
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["comments", movieSlug] }),
  });

  // ===============================================
  // 3. MUTATION: LIKE/UNLIKE
  // ===============================================
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

        (old) => {
          if (!old) return old;
          return updater(old);
        },
      );
      return { previousComments, previousLineage };
    },
    onError: (_err, _commentId, context) => {
      if (context?.previousComments) {
        context.previousComments.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      if (context?.previousLineage) {
        context.previousLineage.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
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
