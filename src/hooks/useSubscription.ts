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

export function useSubscription({ user, movie }: UseSubscriptionProps) {
  const queryClient = useQueryClient();
  const userId = user?.id || "guest";
  const movieSlug = movie?.slug || "";

  // Danh sách các Key dùng chung
  const subQueryKey = ["subscription", movieSlug, userId];
  const listQueryKey = ["subscriptions-list", userId];

  // 1. Lấy trạng thái theo dõi
  const { data: isFollowed = false } = useQuery({
    queryKey: subQueryKey,
    queryFn: async () => {
      if (!movie) return false;

      if (!user) {
        if (typeof window === "undefined") return false;
        const subs = getLocalSubscriptions();
        return subs.some((s) => s.movie_slug === movie.slug);
      }
      const res = await fetch(
        `/api/subscriptions/check?movieSlug=${movie.slug}`,
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

      const firstEpisode = movie.episodes?.[0];
      const lastEpisodeSlug =
        firstEpisode?.server_data?.[
          firstEpisode.server_data.length - 1
        ]?.slug?.trim();

      const itemPayload: SubscriptionItem = {
        movie_slug: movie.slug,
        movie_name: movie.name,
        movie_poster: movie.thumb_url,
        last_known_episode_slug: lastEpisodeSlug,
        movie_status: movie.status,
        has_new_episode: false,
      };

      if (!user) return toggleLocalSubscription(itemPayload);

      if (currentlyFollowed) {
        const res = await fetch(`/api/subscriptions?movieSlug=${movie.slug}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error();
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

    onMutate: async (currentlyFollowed: boolean) => {
      await queryClient.cancelQueries({ queryKey: subQueryKey });
      const previousState = queryClient.getQueryData<boolean>(subQueryKey);
      queryClient.setQueryData(subQueryKey, !currentlyFollowed);
      return { previousState };
    },
    onError: (err, _var, context) => {
      queryClient.setQueryData(subQueryKey, context?.previousState);
      toast.error("Thao tác thất bại!");
    },
    onSuccess: (_, currentlyFollowed) => {
      toast.success(
        currentlyFollowed ? "Đã hủy theo dõi" : "Đã theo dõi phim này",
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: subQueryKey });
      queryClient.invalidateQueries({ queryKey: listQueryKey });
    },
  });

  // 3. Mutation: Xóa Badge (Chấm đỏ tập mới) - TÍCH HỢP MỚI
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
        body: JSON.stringify({ movieSlug: movie.slug }),
      });
      if (!res.ok) throw new Error("Failed to clear badge");
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      const previousList =
        queryClient.getQueryData<SubscriptionItem[]>(listQueryKey);

      // Optimistic update cho danh sách subscription
      queryClient.setQueryData(
        listQueryKey,
        (old: SubscriptionItem[] | undefined) => {
          return old?.map((s) =>
            s.movie_slug === movie.slug ? { ...s, has_new_episode: false } : s,
          );
        },
      );

      return { previousList };
    },
    onError: (_err, _var, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(listQueryKey, context.previousList);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listQueryKey });
      // Cập nhật lại cả trạng thái follow nếu cần
      queryClient.invalidateQueries({ queryKey: subQueryKey });
    },
  });

  const clearBadge = useCallback(() => {
    clearBadgeMutation.mutate();
  }, [clearBadgeMutation.mutate]);

  return {
    isFollowed,
    toggleFollow: () => toggleMutation.mutate(isFollowed),
    clearBadge,
    isLoading: toggleMutation.isPending || clearBadgeMutation.isPending,
  };
}
