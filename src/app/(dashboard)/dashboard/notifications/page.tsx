"use client";

import React from "react";
import {
  BellIcon,
  CheckCircleIcon,
  TrashIcon,
  ChatBubbleLeftEllipsisIcon,
  TicketIcon,
  InboxStackIcon,
  CheckIcon,
  Cog6ToothIcon,
  XMarkIcon,
  DevicePhoneMobileIcon,
  FunnelIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import NotificationCard from "@/components/shared/NotificationCard";
import NotificationSkeleton from "@/components/shared/NotificationSkeleton";
import LoadingPage from "@/components/ui/LoadingPage";
import { useNotification, FilterType } from "@/hooks/useNotification";

export default function NotificationsPage() {
  const {
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
    markAsRead,
    navigateToNotification,
    clearNotifications,
    hasNextPage,
    isFetchingNextPage,
    togglePref,
    isPushLoading,
    handleToggleWebPush,
    saveChanges,
  } = useNotification();

  const tabs = [
    { id: "all", label: "Tất cả", icon: InboxStackIcon },
    { id: "unread", label: "Chưa đọc", icon: BellIcon, count: unreadCount },
    {
      id: "movies",
      label: "Phim mới",
      icon: TicketIcon,
      count: unreadMoviesCount,
    },
    {
      id: "comments",
      label: "Bình luận",
      icon: ChatBubbleLeftEllipsisIcon,
      count: unreadCommentsCount,
    },
  ];

  const currentFilterLabel = tabs.find((t) => t.id === filter)?.label;

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* --- HEADER --- */}
      <div>
        <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
          <BellIcon className="w-8 h-8 text-red-500" /> Thông báo
        </h1>
        <p className="text-zinc-500 mt-1">
          Nơi cập nhật những hoạt động mới nhất của bạn.
        </p>
      </div>

      {/* --- ACTIONS BAR (STICKY) --- */}
      <div className="sticky top-16 z-30 flex items-center justify-between p-2 sm:p-2.5 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 rounded-[1.5rem] shadow-2xl">
        {/* TRÁI: MENU BỘ LỌC */}
        <div className="relative" ref={filterMenuRef}>
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 border ${
              isFilterOpen || filter !== "all"
                ? "bg-white text-black border-white"
                : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800"
            }`}
          >
            <FunnelIcon className="size-4" />
            <span className="uppercase tracking-wider">
              {currentFilterLabel}
            </span>
            <ChevronDownIcon
              className={`size-3 transition-transform duration-300 ${isFilterOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isFilterOpen && (
            <div className="absolute left-0 mt-2 w-52 p-2 space-y-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilter(tab.id as FilterType);
                    setIsFilterOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    filter === tab.id
                      ? "bg-white/10 text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <tab.icon className="size-4" />
                    <span>{tab.label}</span>
                  </div>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* PHẢI: CÁC NÚT HÀNH ĐỘNG */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAsRead()}
              className="flex items-center gap-2 p-2.5 sm:px-4 sm:py-2.5 bg-zinc-900 hover:bg-emerald-600/10 text-zinc-400 hover:text-emerald-500 rounded-xl border border-zinc-800 transition-all active:scale-95"
              title="Đọc tất cả"
            >
              <CheckCircleIcon className="size-5" />
              <span className="hidden sm:inline text-sm font-bold">
                Đọc tất cả
              </span>
            </button>
          )}

          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 bg-zinc-900 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 transition-all active:scale-95"
            title="Cài đặt"
          >
            <Cog6ToothIcon className="size-5" />
          </button>

          <div className="relative" ref={clearMenuRef}>
            <button
              onClick={() => setShowClearMenu(!showClearMenu)}
              className="p-2.5 bg-zinc-900 hover:bg-red-600/10 text-zinc-400 hover:text-red-500 rounded-xl border border-zinc-800 transition-all active:scale-95"
              title="Dọn dẹp"
            >
              <TrashIcon className="size-5" />
            </button>

            {showClearMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in zoom-in-95">
                <button
                  onClick={() => {
                    clearNotifications(true);
                    setShowClearMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors text-left"
                >
                  <CheckIcon className="w-4 h-4 text-zinc-500" />
                  Xóa tin đã đọc
                </button>
                <div className="h-px bg-zinc-800" />
                <button
                  onClick={() => {
                    clearNotifications(false);
                    setShowClearMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 font-bold hover:bg-red-500/10 transition-colors text-left"
                >
                  <TrashIcon className="w-4 h-4" />
                  Xóa tất cả
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- CONTENT (GRID LAYOUT) --- */}
      <div className="transition-opacity duration-300">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-zinc-900/10 rounded-[3rem] border border-dashed border-zinc-800 text-center px-6">
            <BellIcon className="size-12 text-zinc-800 mb-4" />
            <p className="text-zinc-500 font-medium">
              {filter === "all"
                ? "Bạn chưa có thông báo nào"
                : `Không có thông báo nào trong mục ${currentFilterLabel}`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNotifications.map((noti) => (
              <div
                key={noti.id}
                className="bg-zinc-900/40 border border-zinc-800/80 rounded-[1.5rem] overflow-hidden backdrop-blur-md hover:bg-zinc-800/60 transition-colors"
              >
                <NotificationCard
                  variant="list"
                  noti={noti}
                  onClick={() => navigateToNotification(noti)}
                />
              </div>
            ))}

            {/* Skeleton tải thêm khi cuộn đáy */}
            {isFetchingNextPage && (
              <React.Fragment>
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-[1.5rem] overflow-hidden">
                  <NotificationSkeleton variant="list" />
                </div>
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-[1.5rem] overflow-hidden hidden md:block">
                  <NotificationSkeleton variant="list" />
                </div>
              </React.Fragment>
            )}
          </div>
        )}
      </div>

      {/* --- INFINITE SCROLL OBSERVER --- */}
      {hasNextPage && <div ref={loadMoreRef} className="h-10 w-full" />}

      {/* --- MODAL CÀI ĐẶT --- */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#0f0f0f] border border-zinc-800/80 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/40">
              <h2 className="text-xl font-black text-white tracking-tight">
                Cài đặt thông báo
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 transition-all hover:rotate-90"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-7 space-y-8">
              {/* --- WEB PUSH TOGGLE --- */}
              <div className="p-4 sm:p-5 bg-zinc-800/30 border border-zinc-700/50 rounded-3xl flex items-center justify-between group gap-3">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="p-2.5 sm:p-3 bg-red-500/10 text-red-500 rounded-2xl group-hover:scale-110 transition-transform flex-shrink-0">
                    <DevicePhoneMobileIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-bold text-sm truncate">
                      Đăng ký Web Push
                    </h3>
                    <p className="text-zinc-500 text-[10px] sm:text-[11px] leading-tight mt-0.5 line-clamp-2">
                      Nhận thông báo ngay cả khi tắt web.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleToggleWebPush}
                  disabled={isPushLoading}
                  role="switch"
                  aria-checked={prefs.web_push}
                  className={`w-11 h-6 sm:w-12 sm:h-6 rounded-full transition-all relative flex-shrink-0 ${
                    isPushLoading
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer"
                  } ${prefs.web_push ? "bg-red-600" : "bg-zinc-500"}`}
                >
                  <div
                    className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform flex items-center justify-center ${
                      prefs.web_push ? "translate-x-5 sm:translate-x-6" : ""
                    }`}
                  >
                    {isPushLoading && (
                      <div className="w-2.5 h-2.5 border-2 border-zinc-300 border-t-red-600 rounded-full animate-spin" />
                    )}
                  </div>
                </button>
              </div>

              {/* --- CÁC KÊNH THÔNG BÁO --- */}
              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-1">
                  Kênh ứng dụng
                </h3>
                <div className="space-y-5 px-1">
                  <ToggleRow
                    label="Tập phim mới"
                    desc="Phim bạn đã theo dõi có tập mới"
                    isActive={prefs.new_episode}
                    onClick={() => togglePref("new_episode")}
                  />
                  <ToggleRow
                    label="Lượt nhắc tên"
                    desc="Khi có người trả lời bình luận"
                    isActive={prefs.comment_reply}
                    onClick={() => togglePref("comment_reply")}
                  />
                  <ToggleRow
                    label="Phòng xem chung"
                    desc="Lời mời tham gia Watch Party"
                    isActive={prefs.watch_party}
                    onClick={() => togglePref("watch_party")}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-zinc-900/40 border-t border-zinc-800">
              <button
                onClick={saveChanges}
                disabled={isSavingPrefs}
                className="w-full py-4 bg-white text-black font-black rounded-2xl text-sm hover:bg-zinc-200 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSavingPrefs ? "ĐANG LƯU..." : "LƯU THAY ĐỔI"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  isActive,
  onClick,
}: {
  label: string;
  desc: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="switch"
      aria-checked={isActive}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex items-center justify-between group cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-lg"
      onClick={onClick}
    >
      <div className="flex-1 pr-4 min-w-0">
        <h4 className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors tracking-tight truncate">
          {label}
        </h4>
        <p className="text-xs text-zinc-600 line-clamp-1">{desc}</p>
      </div>
      <div
        className={`w-11 h-6 sm:w-12 sm:h-6 rounded-full transition-all relative shrink-0 ${
          isActive ? "bg-emerald-500" : "bg-zinc-500"
        }`}
      >
        <div
          className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
            isActive ? "translate-x-5 sm:translate-x-6" : ""
          }`}
        />
      </div>
    </div>
  );
}
