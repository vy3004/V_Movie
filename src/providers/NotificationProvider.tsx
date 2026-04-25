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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseClient } from "@/lib/supabase/client";
import NotificationCard from "@/components/NotificationCard";
import { useData } from "@/providers/BaseDataContextProvider";
import { NotificationItem } from "@/types";

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id?: string) => Promise<void>;
  navigateToNotification: (noti: NotificationItem) => void;
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

  // 1. Quản lý danh sách thông báo bằng React Query
  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Lỗi API");
      return res.json();
    },
    enabled: !!userId,
    staleTime: Infinity, // Dữ liệu sẽ được update chủ động qua Realtime
  });

  // 2. Đánh dấu đã đọc bằng Mutation
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
      // Optimistic Update: Đổi màu ngay trên UI mà không cần chờ Server
      await queryClient.cancelQueries({ queryKey: ["notifications", userId] });
      const previousNotis = queryClient.getQueryData<NotificationItem[]>([
        "notifications",
        userId,
      ]);

      queryClient.setQueryData<NotificationItem[]>(
        ["notifications", userId],
        (old) => {
          if (!old) return [];
          if (id)
            return old.map((n) => (n.id === id ? { ...n, is_read: true } : n));
          return old.map((n) => ({ ...n, is_read: true }));
        },
      );

      return { previousNotis };
    },
    onError: (err, variables, context) => {
      // Rollback nếu có lỗi
      queryClient.setQueryData(
        ["notifications", userId],
        context?.previousNotis,
      );
      console.error("Lỗi đánh dấu đọc:", err);
    },
  });

  // 3. Logic chuyển hướng
  const navigateToNotification = useCallback(
    async (noti: NotificationItem) => {
      if (!noti.movie_slug) return;

      const commentId = noti.metadata?.comment_id;
      const episode = noti.metadata?.episode || "1";

      // Nếu chưa đọc, ta CHỜ API đánh dấu và Xóa Cache Redis xong mới nhảy trang
      // Việc này đảm bảo trang phim được load với dữ liệu OPhim mới nhất
      if (!noti.is_read) {
        await markAsReadMutation(noti.id);
        // Invalidate Subscriptions để Navbar mất chấm đỏ
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

  // 4. Supabase Realtime Listener
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

          // Thêm thông báo mới vào đầu danh sách Cache
          queryClient.setQueryData<NotificationItem[]>(
            ["notifications", userId],
            (old) => {
              return [newNoti, ...(old || [])];
            },
          );

          // Hiển thị Toast
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

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );

  const contextValue = useMemo(
    () => ({
      notifications,
      unreadCount,
      markAsRead: markAsReadMutation,
      navigateToNotification,
    }),
    [notifications, unreadCount, markAsReadMutation, navigateToNotification],
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
