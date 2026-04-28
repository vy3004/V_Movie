"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import NProgress from "nprogress";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  InfiniteData, // Trích xuất Type này từ thư viện
} from "@tanstack/react-query";
import { createSupabaseClient } from "@/lib/supabase/client";
import NotificationCard from "@/components/shared/NotificationCard";
import { useData } from "@/providers/BaseDataContextProvider";
import { NotificationItem } from "@/types";

// 1. Định nghĩa chuẩn xác cấu trúc trả về từ API
interface NotificationResponse {
  items: NotificationItem[];
  nextCursor: number | null;
  total: number;
}

// 2. Định nghĩa Context Type hoàn chỉnh
interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id?: string) => Promise<void>;
  isLoading: boolean;
  navigateToNotification: (noti: NotificationItem) => void;
  fetchNextPage: () => void;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  clearNotifications: (onlyRead: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export default function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useData() || {};
  const userId = user?.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createSupabaseClient(), []);

  // ==========================================
  // 1. INFINITE QUERY
  // ==========================================
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<NotificationResponse>({
      queryKey: ["notifications", userId],
      queryFn: async ({ pageParam = 1 }) => {
        const res = await fetch(
          `/api/notifications?page=${pageParam}&limit=15`,
        );
        if (!res.ok) throw new Error("Lỗi API");
        return res.json();
      },
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!userId,
      initialPageParam: 1,
      staleTime: Infinity,
    });

  const notifications = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) || [];
  }, [data]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );

  // ==========================================
  // 2. ĐÁNH DẤU ĐÃ ĐỌC
  // ==========================================
  const { mutateAsync: markAsReadMutation } = useMutation({
    mutationFn: async (id?: string) => {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to mark as read");
    },
    onMutate: async (id?: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", userId] });

      // Lấy data cũ với Type cực chuẩn
      const previousData = queryClient.getQueryData<
        InfiniteData<NotificationResponse>
      >(["notifications", userId]);

      // Ép kiểu cho hàm callback của setQueryData
      queryClient.setQueryData<InfiniteData<NotificationResponse>>(
        ["notifications", userId],
        (oldData) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((n) =>
                !id || n.id === id ? { ...n, is_read: true } : n,
              ),
            })),
          };
        },
      );

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ["notifications", userId],
          context.previousData,
        );
      }
      console.error("Lỗi đánh dấu đọc:", err);
    },
  });

  // ==========================================
  // 3. DỌN DẸP THÔNG BÁO
  // ==========================================
  const { mutateAsync: clearNotificationsMutation } = useMutation({
    mutationFn: async (onlyRead: boolean) => {
      const res = await fetch(`/api/notifications?onlyRead=${onlyRead}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear notifications");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      toast.success("Đã dọn dẹp hòm thư!");
    },
  });

  // ==========================================
  // 4. ĐIỀU HƯỚNG
  // ==========================================
  const navigateToNotification = useCallback(
    async (noti: NotificationItem) => {
      if (!noti.movie_slug) return;
      const commentId = noti.metadata?.comment_id;
      const episode = noti.metadata?.episode || "1";

      if (!noti.is_read) {
        await markAsReadMutation(noti.id);
        queryClient.invalidateQueries({
          queryKey: ["subscriptions-list", userId],
        });
      }

      const url = commentId
        ? `/phim/${noti.movie_slug}?tap=${episode}&commentId=${commentId}#comment-${commentId}`
        : `/phim/${noti.movie_slug}?tap=${episode}`;

      NProgress.start();
      router.push(url);
    },
    [router, markAsReadMutation, queryClient, userId],
  );

  // ==========================================
  // 5. REALTIME LISTENER
  // ==========================================
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`realtime-noti-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNoti = payload.new as NotificationItem;

          // Ép kiểu chuẩn cho Realtime chèn data
          queryClient.setQueryData<InfiniteData<NotificationResponse>>(
            ["notifications", userId],
            (oldData) => {
              if (!oldData) {
                return {
                  pages: [{ items: [newNoti], nextCursor: null, total: 1 }],
                  pageParams: [1],
                };
              }

              const newPages = [...oldData.pages];
              if (newPages.length > 0) {
                newPages[0] = {
                  ...newPages[0],
                  items: [newNoti, ...newPages[0].items],
                };
              } else {
                newPages.push({
                  items: [newNoti],
                  nextCursor: null,
                  total: 1,
                });
              }

              return { ...oldData, pages: newPages };
            },
          );

          toast.custom(
            (t) => (
              <NotificationCard
                variant="toast"
                noti={newNoti}
                onClick={() => {
                  toast.dismiss(t);
                  navigateToNotification(newNoti);
                }}
              />
            ),
            { duration: 6000, position: "bottom-right" },
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, queryClient, navigateToNotification]);

  const contextValue: NotificationContextType = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      markAsRead: markAsReadMutation,
      navigateToNotification,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      clearNotifications: clearNotificationsMutation,
    }),
    [
      notifications,
      unreadCount,
      isLoading,
      markAsReadMutation,
      navigateToNotification,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      clearNotificationsMutation,
    ],
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context)
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  return context;
};
