"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import NotificationCard from "@/components/NotificationCard";
import { useData } from "@/providers/BaseDataContextProvider";
import { NotificationItem } from "@/lib/types";

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const { user } = useData() || {};
  const userId = user?.id;
  const router = useRouter();

  const supabase = useMemo(() => createSupabaseClient(), []);

  const isFetchingRef = useRef(false);
  const fetchedUserId = useRef<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId || isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Lỗi API");
      const data = await res.json();
      setNotifications(data);
      fetchedUserId.current = userId;
    } catch (error) {
      console.error("Fetch notifications failed", error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [userId]);

  const markAsRead = useCallback(async (id?: string) => {
    setNotifications((prev) => {
      if (id) {
        return prev.map((n) => (n.id === id ? { ...n, is_read: true } : n));
      }
      return prev.map((n) => ({ ...n, is_read: true }));
    });

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ id }),
      });
    } catch (error) {
      console.error("Lỗi khi đánh dấu đã đọc", error);
    }
  }, []);

  const navigateToNotification = useCallback(
    (noti: NotificationItem) => {
      if (!noti.movie_slug) return;

      const metadata = noti.metadata;
      const commentId = metadata?.comment_id;
      const episode = metadata?.episode || "1";

      if (!commentId) {
        router.push(`/phim/${noti.movie_slug}?tap=${episode}`);
        if (!noti.is_read) markAsRead(noti.id);
        return;
      }

      /**
       * CHIẾN THUẬT: Chỉ gửi duy nhất commentId.
       * Hook useCommentsQuery sẽ bắt được ID này và tự gọi API nạp nguyên cây gia phả.
       */
      const url = `/phim/${noti.movie_slug}?tap=${episode}&commentId=${commentId}#comment-${commentId}`;

      if (!noti.is_read) markAsRead(noti.id);
      router.push(url);
    },
    [router, markAsRead],
  );

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      fetchedUserId.current = null;
      return;
    }

    if (fetchedUserId.current !== userId) {
      fetchNotifications();
    }

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
          setNotifications((prev) => [newNoti, ...prev]);

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
            {
              duration: 6000,
              position: "bottom-right",
            },
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, fetchNotifications, navigateToNotification]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );

  const contextValue = useMemo(
    () => ({ notifications, unreadCount, markAsRead, navigateToNotification }),
    [notifications, unreadCount, markAsRead, navigateToNotification],
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
