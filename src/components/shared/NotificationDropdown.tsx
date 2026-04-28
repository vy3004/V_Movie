"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useInView } from "react-intersection-observer";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import NotificationCard from "@/components/shared/NotificationCard";
import NotificationSkeleton from "@/components/shared/NotificationSkeleton";
import { useNotifications } from "@/providers/NotificationProvider";

interface Props {
  setIsOpen: (val: boolean) => void;
  bellRef: React.RefObject<HTMLDivElement>;
}

export default function NotificationDropdown({ setIsOpen, bellRef }: Props) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    navigateToNotification,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications();

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [bellRef, setIsOpen]);

  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="absolute -right-[40px] md:right-0 top-full pt-2 w-80 sm:w-96 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <span className="text-sm font-bold text-white">Thông báo</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAsRead()}
              className="text-xs font-bold text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <CheckCircleIcon className="size-4 text-emerald-500" />
              Đánh dấu đã đọc
            </button>
          )}
        </div>

        {/* Danh sách */}
        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
          {!notifications.length && isFetchingNextPage ? (
            <div className="divide-y divide-zinc-800/50">
              {Array.from({ length: 4 }).map((_, i) => (
                <NotificationSkeleton key={i} variant="list" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-10 text-center text-zinc-500 text-sm">
              Bạn chưa có thông báo nào
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {notifications.map((noti) => (
                <NotificationCard
                  key={noti.id}
                  variant="list"
                  noti={noti}
                  // Không cần truyền ref vào thẻ cuối nữa
                  onClick={() => {
                    setIsOpen(false);
                    navigateToNotification(noti);
                  }}
                />
              ))}

              {/* VÙNG DÒ CUỘN & SKELETON */}
              {isFetchingNextPage && <NotificationSkeleton variant="list" />}
              {hasNextPage && <div ref={ref} className="h-4" />}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-zinc-800 text-center bg-zinc-900/80">
          <Link
            href="/dashboard/notifications"
            onClick={() => setIsOpen(false)}
            className="text-xs font-bold text-zinc-400 hover:text-white w-full py-1 block transition-colors"
          >
            Xem tất cả thông báo
          </Link>
        </div>
      </div>
    </div>
  );
}
