"use client";

import React, { useState, useRef, useEffect } from "react";
import { BellIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import NotificationCard from "@/components/NotificationCard";
import { useNotifications } from "@/providers/NotificationProvider";
import Link from "next/link";

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, navigateToNotification } =
    useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  return (
    <div className="relative" ref={bellRef}>
      {/* Icon Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Thông báo"
        className="relative flex items-center justify-center size-8 sm:size-10 rounded-full transition-all bg-zinc-800 hover:bg-zinc-700"
      >
        <BellIcon className="size-5 sm:size-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 min-w-[16px] px-1 bg-red-600 rounded-full shadow-sm shadow-red-900/50">
            <span className="text-[10px] font-bold text-white leading-none inline-block">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      <div
        className={`absolute -right-[40px] md:right-0 top-full pt-2 w-80 sm:w-96 transition-all duration-300 z-50 ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      >
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 flex flex-col">
          <div className="px-4 py-2 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
            <span className="text-sm font-semibold text-white">Thông báo</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAsRead()}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1"
              >
                <CheckCircleIcon className="size-3.5" />
                Đọc tất cả
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-10 text-center text-zinc-500 text-sm">
                Bạn chưa có thông báo nào
              </div>
            ) : (
              notifications.map((noti) => (
                <NotificationCard
                  key={noti.id}
                  variant="list"
                  noti={noti}
                  onClick={() => {
                    setIsOpen(false);
                    navigateToNotification(noti);
                  }}
                />
              ))
            )}
          </div>

          <div className="p-2 border-t border-zinc-800 text-center bg-zinc-900/50">
            <Link
              href="/dashboard/notifications"
              className="text-xs text-zinc-500 hover:text-zinc-300 w-full py-1"
            >
              Xem tất cả
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
