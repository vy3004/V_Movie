"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Movie, SubscriptionItem } from "@/lib/types";
import { getLocalSubscriptions, toggleLocalSubscription } from "@/lib/utils";

interface UseSubscriptionProps {
  user: User | null | undefined;
  movie: Movie;
}

export function useSubscription({ user, movie }: UseSubscriptionProps) {
  const queryClient = useQueryClient();
  const queryKey = ["subscription", movie.slug, user?.id || "guest"];

  const { data: isFollowed = false } = useQuery({
    queryKey,
    queryFn: async () => {
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
    staleTime: 1000 * 60 * 5,
  });

  const mutation = useMutation({
    mutationFn: async (currentlyFollowed: boolean) => {
      const lastEpisodeSlug =
        movie.episodes?.[0]?.server_data?.[
          movie.episodes[0].server_data.length - 1
        ]?.slug.trim();
      const itemPayload: SubscriptionItem = {
        movie_slug: movie.slug,
        movie_name: movie.name,
        movie_poster: movie.thumb_url,
        last_known_episode_slug: lastEpisodeSlug,
        movie_status: movie.status,
        has_new_episode: false,
      };

      if (!user) {
        return toggleLocalSubscription(itemPayload);
      }

      if (currentlyFollowed) {
        const res = await fetch(`/api/subscriptions?movieSlug=${movie.slug}`, {
          method: "DELETE",
        });
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

    onMutate: async (currentlyFollowed: boolean) => {
      await queryClient.cancelQueries({ queryKey });
      const previousState = queryClient.getQueryData<boolean>(queryKey);
      queryClient.setQueryData(queryKey, !currentlyFollowed);
      return { previousState };
    },

    // Sửa lỗi 6133 bằng cách dùng _ hoặc bỏ biến
    onError: (err, _variables, context) => {
      if (context?.previousState !== undefined) {
        queryClient.setQueryData(queryKey, context.previousState);
      }

      // Toast lỗi bằng Sonner
      toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
      console.error("Subscription toggle failed:", err);
    },

    onSuccess: (_, currentlyFollowed) => {
      // Toast thành công
      toast.success(
        currentlyFollowed ? "Đã hủy theo dõi" : "Đã theo dõi phim này",
      );
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["subscriptions-list"] });
    },
  });

  return {
    isFollowed,
    toggleFollow: () => mutation.mutate(isFollowed),
    isLoading: mutation.isPending,
  };
}
