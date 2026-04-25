"use client";

import React, { useState, useMemo } from "react";
import {
  BellIcon,
  CheckCircleIcon,
  FunnelIcon,
  TrashIcon,
  ChatBubbleLeftEllipsisIcon,
  TicketIcon,
  InboxStackIcon,
} from "@heroicons/react/24/outline";
import NotificationCard from "@/components/NotificationCard";
import LoadingPage from "@/components/LoadingPage";
import { useNotifications } from "@/providers/NotificationProvider";

type FilterType = "all" | "unread" | "movies" | "comments";

export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, navigateToNotification } =
    useNotifications();
  const [filter, setFilter] = useState<FilterType>("all");

  // Logic lọc thông báo
  const filteredNotifications = useMemo(() => {
    if (!notifications) return [];
    switch (filter) {
      case "unread":
        return notifications.filter((n) => !n.is_read);
      case "movies":
        return notifications.filter((n) => n.type === "new_episode");
      case "comments":
        return notifications.filter((n) => n.type === "comment_reply");
      default:
        return notifications;
    }
  }, [notifications, filter]);

  const tabs = [
    { id: "all", label: "Tất cả", icon: InboxStackIcon },
    { id: "unread", label: "Chưa đọc", icon: BellIcon, count: unreadCount },
    { id: "movies", label: "Phim mới", icon: TicketIcon },
    { id: "comments", label: "Bình luận", icon: ChatBubbleLeftEllipsisIcon },
  ];

  if (!notifications) return <LoadingPage />;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* 1. HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <BellIcon className="w-8 h-8 text-red-500" /> Thông báo
          </h1>
          <p className="text-zinc-500 mt-2">
            Cập nhật những hoạt động mới nhất từ V-Movie.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAsRead()}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl font-bold text-sm transition-all border border-zinc-700"
            >
              <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
              Đọc tất cả
            </button>
          )}
          <button className="p-2.5 bg-zinc-800/50 hover:bg-red-600/10 hover:text-red-500 text-zinc-500 rounded-2xl transition-all border border-zinc-700/50">
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. FILTER TABS */}
      <div className="flex items-center gap-2 p-1.5 bg-zinc-900/50 border border-zinc-800 rounded-[2rem] overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as FilterType)}
            className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] text-sm font-bold whitespace-nowrap transition-all duration-300 ${
              filter === tab.id
                ? "bg-zinc-100 text-black shadow-lg shadow-white/5"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${filter === tab.id ? "bg-black text-white" : "bg-red-600 text-white"}`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 3. NOTIFICATION LIST */}
      <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="p-6 bg-zinc-800/50 rounded-full">
              <FunnelIcon className="w-12 h-12 text-zinc-600" />
            </div>
            <div className="text-center">
              <p className="text-zinc-400 font-bold text-lg">
                Không tìm thấy thông báo
              </p>
              <p className="text-zinc-600 text-sm">
                Hãy thử thay đổi bộ lọc hoặc quay lại sau nhé.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {filteredNotifications.map((noti) => (
              <NotificationCard
                key={noti.id}
                variant="list"
                noti={noti}
                onClick={() => navigateToNotification(noti)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 4. FOOTER INFO */}
      <div className="flex justify-center italic">
        <p className="text-zinc-600 text-xs text-center max-w-md">
          Thông báo sẽ tự động được dọn dẹp sau 30 ngày để tối ưu dung lượng hệ
          thống.
        </p>
      </div>
    </div>
  );
}
