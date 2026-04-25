"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Movie, SubscriptionItem } from "@/types";
import { getLocalSubscriptions, toggleLocalSubscription } from "@/lib/utils";
import { useCallback } from "react";

interface UseSubscriptionProps {
  user: User | null | undefined;
  movie: Movie;
}

export function useSubscriptionAction({ user, movie }: UseSubscriptionProps) {
  const queryClient = useQueryClient();
  const userId = user?.id || "guest";
  const movieSlug = movie?.slug || "";

  const subStatusKey = ["subscription-status", movieSlug, userId];
  const listQueryKey = ["subscriptions-list"];
  const statsQueryKey = ["subscriptions-stats"];

  // 1. Lấy trạng thái theo dõi
  const { data: isFollowed = false } = useQuery({
    queryKey: subStatusKey,
    queryFn: async () => {
      if (!movie) return false;
      if (!user) {
        const subs = getLocalSubscriptions();
        return subs.some((s) => s.movie_slug === movie.slug);
      }
      const res = await fetch(
        `/api/subscriptions/check?movieSlug=${encodeURIComponent(movie.slug)}`,
      );
      if (!res.ok) return false;
      const data = await res.json();
      return data.isFollowed;
    },
    enabled: !!movie,
    staleTime: 1000 * 60 * 5,
  });

  // 2. Mutation: Theo dõi / Hủy theo dõi
  const toggleMutation = useMutation({
    mutationFn: async (currentlyFollowed: boolean) => {
      if (!movie) throw new Error("Chưa tải xong thông tin phim");

      const itemPayload: SubscriptionItem = {
        movie_slug: movie.slug,
        movie_name: movie.name,
        movie_poster: movie.thumb_url,
        last_known_episode_slug:
          movie.episodes?.[0]?.server_data?.slice(-1)[0]?.slug,
        movie_status: movie.status,
        has_new_episode: false,
      };

      if (!user) return toggleLocalSubscription(itemPayload);

      if (currentlyFollowed) {
        const res = await fetch(
          `/api/subscriptions?movieSlug=${encodeURIComponent(movie.slug)}`,
          {
            method: "DELETE",
          },
        );
        if (!res.ok) throw new Error("Lỗi khi hủy theo dõi");
        return false;
      } else {
        const res = await fetch("/api/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemPayload),
        });
        if (!res.ok) throw new Error("Lỗi khi theo dõi");
        return true;
      }
    },
    onMutate: async (currentlyFollowed) => {
      // Optimistic Update cho nút Heart
      await queryClient.cancelQueries({ queryKey: subStatusKey });
      const previousState = queryClient.getQueryData<boolean>(subStatusKey);
      queryClient.setQueryData(subStatusKey, !currentlyFollowed);
      return { previousState };
    },
    onError: (err, _var, context) => {
      queryClient.setQueryData(subStatusKey, context?.previousState);
      toast.error("Thao tác thất bại!");
    },
    onSuccess: (_, currentlyFollowed) => {
      toast.success(
        currentlyFollowed ? "Đã hủy theo dõi" : "Đã theo dõi phim này",
      );

      // LÀM MỚI CACHE NGAY LẬP TỨC ĐỂ TRANG CHỦ CẬP NHẬT
      queryClient.invalidateQueries({
        queryKey: listQueryKey,
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: statsQueryKey,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: subStatusKey });
    },
  });

  // 3. Mutation: Xóa Badge (Chấm đỏ tập mới)
  const clearBadgeMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        const localSubs = getLocalSubscriptions();
        const updatedSubs = localSubs.map((s) =>
          s.movie_slug === movie.slug ? { ...s, has_new_episode: false } : s,
        );
        localStorage.setItem(
          "v_movie_guest_subscriptions",
          JSON.stringify(updatedSubs),
        );
        return;
      }
      const res = await fetch("/api/subscriptions/clear-badge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieSlug: movie.slug }),
      });
      if (!res.ok) throw new Error("Failed to clear badge");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listQueryKey,
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: statsQueryKey,
      });
    },
  });

  const clearBadge = useCallback(() => {
    clearBadgeMutation.mutate();
  }, [clearBadgeMutation]);

  return {
    isFollowed,
    toggleFollow: () => toggleMutation.mutate(isFollowed),
    clearBadge,
    isLoading: toggleMutation.isPending || clearBadgeMutation.isPending,
  };
}
