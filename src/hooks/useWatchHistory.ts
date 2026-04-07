"use client";

import { useRef, useEffect, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { saveLocalHistory, getLocalHistory, getDeviceId } from "@/lib/utils";
import { HistoryItem, HistoryUpdatePayload, Movie } from "@/lib/types";

interface UseWatchHistoryProps {
  user: User | null | undefined;
  movie: Movie;
  episodeSlug: string;
}

// LocalStorage key for pending sync queue
const PENDING_SYNC_KEY = "v_movie_pending_history_sync";

/**
 * PHASE 4: FRONTEND - TRACKING LOGIC (THE BRAIN)
 * 
 * Logic chi tiết:
 * 1. Khởi tạo trackingData = useRef<HistoryUpdatePayload>() để lưu current_time liên tục mà không re-render React.
 * 2. Sự kiện onTimeUpdate từ Video Player chỉ cập nhật giá trị vào trackingData.current.
 * 3. Tạo hàm syncToServer(). Hàm này gửi trackingData.current lên /api/history/track.
 *    Dùng navigator.sendBeacon(url, Blob(JSON)) thay vì fetch để đảm bảo không bị chặn khi tắt tab.
 * 4. Khi nào gọi syncToServer()?
 *    - Khi Video Player trigger sự kiện onPause.
 *    - Thêm Event Listener cho cửa sổ: visibilitychange (khi user chuyển tab, check document.visibilityState === 'hidden').
 *    - Thêm Event Listener: beforeunload (khi user đóng trình duyệt).
 * 5. Hỗ trợ LocalStorage fallback: Nếu API lỗi, lưu queue các bản cập nhật vào LocalStorage để gửi lại sau.
 */
export function useWatchHistory({ user, movie, episodeSlug }: UseWatchHistoryProps) {
  // 1. useRef để lưu tracking data mà không re-render React
  const trackingData = useRef<HistoryUpdatePayload | null>(null);

  // Ref để track episodeSlug mới nhất (tránh stale closure trong event listeners)
  const episodeSlugRef = useRef(episodeSlug);
  episodeSlugRef.current = episodeSlug;

  // Ref để track user mới nhất
  const userRef = useRef(user);
  userRef.current = user;

  // Ref để track movie mới nhất
  const movieRef = useRef(movie);
  movieRef.current = movie;

  /**
   * Helper: Lưu vào pending sync queue trong LocalStorage
   * Dùng khi API call thất bại
   */
  const saveToPendingQueue = useCallback((payload: HistoryUpdatePayload) => {
    if (typeof window === "undefined") return;

    try {
      const pendingQueue = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || "[]");
      pendingQueue.push({
        ...payload,
        timestamp: Date.now(),
      });
      // Giới hạn queue tối đa 50 items
      const trimmedQueue = pendingQueue.slice(-50);
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(trimmedQueue));
    } catch (error) {
      console.error("[WatchHistory] Error saving to pending queue:", error);
    }
  }, []);

  /**
   * Helper: Gửi các pending items từ LocalStorage queue lên server
   * Called khi user đăng nhập hoặc khi có cơ hội gửi
   */
  const flushPendingQueue = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!userRef.current) return; // Chỉ gửi khi đã đăng nhập

    try {
      const pendingQueue = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || "[]");
      if (pendingQueue.length === 0) return;

      // Gửi từng item trong queue
      pendingQueue.forEach((item: HistoryUpdatePayload & { timestamp: number }) => {
        const { timestamp, ...payload } = item;
        // Chỉ gửi các item không quá cũ (trong vòng 24 giờ)
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          navigator.sendBeacon(
            "/api/history/track",
            new Blob([JSON.stringify(payload)], { type: "application/json" })
          );
        }
      });

      // Xóa queue sau khi gửi
      localStorage.removeItem(PENDING_SYNC_KEY);
    } catch (error) {
      console.error("[WatchHistory] Error flushing pending queue:", error);
    }
  }, []);

  /**
   * Helper: Gửi đầy đủ HistoryItem lên Supabase để đồng bộ
   * Chỉ gọi khi hoàn thành tập phim hoặc khi đóng tab
   * KHÔNG gọi ở mỗi lần sync thông thường để tránh overload DB
   */
  const syncFullHistoryToSupabase = useCallback((forceSync: boolean = false) => {
    if (!movieRef.current || !userRef.current) return;

    const payload = trackingData.current;
    if (!payload) return;

    // Nghiệp vụ: Chỉ lưu nếu ep_last_time > 30 giây
    if (payload.current_time < 30 && !forceSync) return;

    const isFinished = payload.duration > 0 && (payload.current_time / payload.duration) > 0.9;
    
    // Chỉ sync lên Supabase khi:
    // 1. Hoàn thành tập phim (> 90%) HOẶC forceSync (khi đóng tab)
    // 2. Không sync nếu đang ở giữa tập phim (tránh overload DB)
    if (!isFinished && !forceSync) return;

    const historyItem: HistoryItem = {
      movie_slug: movieRef.current.slug,
      movie_name: movieRef.current.name,
      movie_poster: movieRef.current.poster_url,
      last_episode_slug: episodeSlugRef.current,
      episodes_progress: {
        [episodeSlugRef.current]: {
          ep_last_time: payload.current_time,
          ep_duration: payload.duration,
          ep_is_finished: isFinished,
          ep_updated_at: new Date().toISOString(),
        },
      },
      is_finished: isFinished,
      updated_at: new Date().toISOString(),
    };

    // Dùng sendBeacon để đảm bảo request không bị hủy khi tắt tab
    navigator.sendBeacon(
      "/api/history",
      new Blob([JSON.stringify(historyItem)], { type: "application/json" })
    );

    // Dispatch event để HistorySection cập nhật ngay lập tức
    window.dispatchEvent(new Event("local-history-updated"));
  }, []);

  /**
   * 3. syncToServer() - Gửi tracking data lên server (Redis ONLY)
   * Dùng navigator.sendBeacon để đảm bảo không bị chặn khi tắt tab
   * 
   * SUPABASE: Chỉ sync khi hoàn thành tập phim hoặc forceSync
   */
  const syncToServer = useCallback((forceSync: boolean = false) => {
    if (!movieRef.current || !episodeSlugRef.current) return;

    const payload = trackingData.current;
    if (!payload) return;

    // Nghiệp vụ: Chỉ lưu nếu ep_last_time > 30 giây
    if (payload.current_time < 30) return;

    // Get device_id for guest users
    const deviceId = getDeviceId();

    // Build final payload with user_id and device_id
    const finalPayload: HistoryUpdatePayload = {
      ...payload,
      user_id: userRef.current?.id,
      device_id: userRef.current ? undefined : deviceId,
      movie_name: movieRef.current.name,
      movie_poster: movieRef.current.poster_url,
      last_episode_slug: episodeSlugRef.current,
    };

    if (userRef.current) {
      // User đã đăng nhập - gửi lên API track (Redis)
      const success = navigator.sendBeacon(
        "/api/history/track",
        new Blob([JSON.stringify(finalPayload)], { type: "application/json" })
      );

      // Nếu sendBeacon thất bại, lưu vào pending queue
      if (!success) {
        saveToPendingQueue(finalPayload);
      }

      // Supabase: Chỉ sync khi hoàn thành tập phim hoặc forceSync (đóng tab)
      syncFullHistoryToSupabase(forceSync);
    } else {
      // User chưa đăng nhập - lưu vào LocalStorage
      const isFinished = payload.duration > 0 && (payload.current_time / payload.duration) > 0.9;
      
      // Lấy existing history để merge episodes_progress
      const existingLocalHistory = getLocalHistory();
      const existingMovie = existingLocalHistory.find(
        (h) => h.movie_slug === movieRef.current.slug
      );
      const existingProgress = existingMovie?.episodes_progress || {};
      
      // Merge với existing progress (giữ lại tất cả tập đã xem)
      const mergedProgress = {
        ...existingProgress,
        [episodeSlugRef.current]: {
          ep_last_time: finalPayload.current_time,
          ep_duration: finalPayload.duration,
          ep_is_finished: isFinished,
          ep_updated_at: new Date().toISOString(),
        },
      };
      
      const historyItem: HistoryItem = {
        movie_slug: movieRef.current.slug,
        movie_name: movieRef.current.name,
        movie_poster: movieRef.current.poster_url,
        last_episode_slug: episodeSlugRef.current,
        episodes_progress: mergedProgress,
        is_finished: isFinished,
        updated_at: new Date().toISOString(),
      };
      saveLocalHistory(historyItem);
      // Dispatch event để HistorySection cập nhật ngay lập tức
      window.dispatchEvent(new Event("local-history-updated"));
    }
  }, [saveToPendingQueue, syncFullHistoryToSupabase]);

  /**
   * 2. onTimeUpdate - Chỉ cập nhật ref, KHÔNG re-render
   */
  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    trackingData.current = {
      movie_slug: movieRef.current?.slug || "",
      last_episode_slug: episodeSlugRef.current,
      current_time: currentTime,
      duration: duration,
    };
  }, []);

  /**
   * Handler cho sự kiện onPause từ VideoPlayer
   * Gọi syncToServer với forceSync khi pause để đảm bảo dữ liệu được lưu
   */
  const handlePause = useCallback(() => {
    // Force sync on pause to ensure progress is saved to Supabase
    syncToServer(true);
  }, [syncToServer]);

  // Flush pending queue khi user đăng nhập
  useEffect(() => {
    if (user) {
      flushPendingQueue();
    }
  }, [user, flushPendingQueue]);

  // 4. Event Listeners: visibilitychange, beforeunload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Khi chuyển tab - chỉ gửi Redis, KHÔNG force sync Supabase
        // Tránh việc sync không cần thiết khi user chỉ tạm thời chuyển tab
        syncToServer(false);
      }
    };

    const handleBeforeUnload = () => {
      // Khi đóng tab - force sync để đảm bảo dữ liệu được lưu Supabase
      syncToServer(true);
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Sync lần cuối khi unmount - force sync để đảm bảo dữ liệu được lưu
      syncToServer(true);
    };
  }, [syncToServer]);

  // Cố gắng flush pending queue khi trang load (nếu có user)
  useEffect(() => {
    if (userRef.current) {
      // Delay một chút để đảm bảo localStorage sẵn sàng
      const timer = setTimeout(() => {
        flushPendingQueue();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  return { 
    handleTimeUpdate, 
    handlePause,
    syncToServer,
    flushPendingQueue,
  };
}