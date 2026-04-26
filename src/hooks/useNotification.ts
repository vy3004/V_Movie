import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useInView } from "react-intersection-observer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/providers/NotificationProvider";
import { NotificationItem } from "@/types";
import { urlBase64ToUint8Array } from "@/lib/utils";

export type FilterType = "all" | "unread" | "movies" | "comments";

export interface NotificationPrefs {
  new_episode: boolean;
  comment_reply: boolean;
  watch_party: boolean;
  web_push: boolean;
}

export function useNotification() {
  const queryClient = useQueryClient();
  const {
    notifications,
    unreadCount,
    markAsRead,
    navigateToNotification,
    clearNotifications,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isNotiLoading,
  } = useNotifications();

  // 1. STATE QUẢN LÝ UI
  const [filter, setFilter] = useState<FilterType>("all");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [showClearMenu, setShowClearMenu] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isPushLoading, setIsPushLoading] = useState<boolean>(false);

  const filterMenuRef = useRef<HTMLDivElement>(null);
  const clearMenuRef = useRef<HTMLDivElement>(null);

  // ==========================================
  // 2. TÍCH HỢP API CÀI ĐẶT (PREFERENCES)
  // ==========================================

  // Lấy dữ liệu cài đặt từ Server
  const {
    data: prefs = {
      new_episode: true,
      comment_reply: true,
      watch_party: true,
      web_push: false,
    },
    isLoading: isPrefsLoading,
  } = useQuery<NotificationPrefs>({
    queryKey: ["user-notification-prefs"],
    queryFn: async () => {
      const res = await fetch("/api/user/preferences");
      if (!res.ok) throw new Error("Lỗi tải cài đặt");
      return res.json();
    },
    staleTime: Infinity,
  });

  const isLoading = isNotiLoading || isPrefsLoading;

  // Mutation để lưu cài đặt lên Server
  const { mutate: savePrefsMutation, isPending: isSavingPrefs } = useMutation({
    mutationFn: async (newPrefs: NotificationPrefs) => {
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
      });
      if (!res.ok) throw new Error("Lỗi lưu cài đặt");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notification-prefs"] });
      toast.success("Đã lưu thiết lập thông báo!");
      setShowSettings(false);
    },
    onError: () => {
      toast.error("Có lỗi xảy ra khi lưu. Thử lại sau!");
    },
  });

  // Hàm Gạt Nút (Optimistic Update - Gạt là UI đổi ngay)
  const togglePref = (key: keyof NotificationPrefs) => {
    const updatedPrefs = { ...prefs, [key]: !prefs[key] };
    queryClient.setQueryData(["user-notification-prefs"], updatedPrefs);
  };

  // Nút LƯU THAY ĐỔI sẽ gọi hàm này
  const saveChanges = () => {
    savePrefsMutation(prefs);
  };

  const handleToggleWebPush = async () => {
    if (isPushLoading) return;
    setIsPushLoading(true);

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        toast.error("Trình duyệt của bạn không hỗ trợ Web Push");
        return;
      }

      // TRƯỜNG HỢP 1: USER MUỐN TẮT THÔNG BÁO ĐẨY
      if (prefs.web_push) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await subscription.unsubscribe();
          await fetch("/api/user/push-subscription", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
        }

        // 1. Cập nhật UI ngay lập tức
        togglePref("web_push");

        // 2. GỌI API LƯU XUỐNG BẢNG PREFERENCES NGAY LẬP TỨC
        savePrefsMutation({ ...prefs, web_push: false });

        return;
      }

      // TRƯỜNG HỢP 2: USER MUỐN BẬT THÔNG BÁO ĐẨY
      if (Notification.permission === "denied") {
        toast.error(
          "Bạn đã chặn thông báo. Vui lòng bấm vào biểu tượng ổ khóa 🔒 trên thanh địa chỉ URL để cho phép lại nhé!",
        );
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Bạn đã từ chối cấp quyền thông báo.");
        return;
      }

      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        console.warn("Chưa có Service Worker, đang đăng ký thủ công...");
        await navigator.serviceWorker.register("/sw.js");
      }

      registration = await navigator.serviceWorker.ready;
      if (!registration) {
        toast.error("Không tìm thấy Service Worker. Hãy thử build lại dự án!");
        return;
      }

      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        toast.error("Lỗi hệ thống: Thiếu khóa bảo mật VAPID");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });

      const res = await fetch("/api/user/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      });

      if (!res.ok) throw new Error("Lỗi khi lưu vào Database");

      // 1. Cập nhật UI ngay lập tức
      togglePref("web_push");

      // 2. GỌI API LƯU XUỐNG BẢNG PREFERENCES NGAY LẬP TỨC
      savePrefsMutation({ ...prefs, web_push: true });

      // Lưu ý: Bỏ cái toast.success ở mutation đi nếu không muốn nó hiện 2 lần
      toast.success("Bật thông báo đẩy thành công! 🎉");
    } catch (error: unknown) {
      console.error("Lỗi Web Push:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra khi cấu hình thông báo đẩy.";
      toast.error(errorMessage);
    } finally {
      setIsPushLoading(false);
    }
  };

  // ==========================================
  // 3. LOGIC CUỘN VÔ TẬN & LỌC DỮ LIỆU
  // ==========================================
  const { ref: loadMoreRef, inView } = useInView();

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { filteredNotifications, unreadMoviesCount, unreadCommentsCount } =
    useMemo(() => {
      let filtered: NotificationItem[] = notifications;
      if (filter === "unread")
        filtered = notifications.filter((n) => !n.is_read);
      if (filter === "movies")
        filtered = notifications.filter((n) => n.type === "new_episode");
      if (filter === "comments")
        filtered = notifications.filter((n) => n.type === "comment_reply");

      return {
        filteredNotifications: filtered,
        unreadMoviesCount: notifications.filter(
          (n) => !n.is_read && n.type === "new_episode",
        ).length,
        unreadCommentsCount: notifications.filter(
          (n) => !n.is_read && n.type === "comment_reply",
        ).length,
      };
    }, [notifications, filter]);

  // CLICK OUTSIDE
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        clearMenuRef.current &&
        !clearMenuRef.current.contains(e.target as Node)
      ) {
        setShowClearMenu(false);
      }
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(e.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return {
    isLoading,
    filter,
    setFilter,
    isFilterOpen,
    setIsFilterOpen,
    showClearMenu,
    setShowClearMenu,
    showSettings,
    setShowSettings,
    prefs,
    isSavingPrefs,
    filterMenuRef,
    clearMenuRef,
    loadMoreRef,
    unreadCount,
    unreadMoviesCount,
    unreadCommentsCount,
    filteredNotifications,
    notificationsLength: notifications.length,
    markAsRead,
    navigateToNotification,
    clearNotifications,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    togglePref,
    isPushLoading,
    handleToggleWebPush,
    saveChanges,
  };
}
