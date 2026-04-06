"use client";

import React from "react";
import Link from "next/link";
import {
  HeartIcon,
  ClockIcon,
  UserIcon,
  ArrowLeftEndOnRectangleIcon,
} from "@heroicons/react/24/solid";

import { createSupabaseClient } from "@/lib/supabase/client";
import { useAuthModal } from "@/providers/AuthModalProvider";
import { useData } from "@/providers/BaseDataContextProvider"; // Import useData

export default function UserButton() {
  const supabase = createSupabaseClient();
  const { onOpen } = useAuthModal();

  const { user, authLoading } = useData()!;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Sau khi sign out, BaseDataContextProvider sẽ tự động cập nhật lại user = null
  };

  // 1. Trạng thái đang nạp Auth (Loading)
  if (authLoading) {
    return (
      <div className="size-7 sm:size-9 rounded-full bg-zinc-800 animate-pulse" />
    );
  }

  // 2. Trường hợp chưa đăng nhập (GUEST)
  if (!user) {
    return (
      <button
        onClick={onOpen}
        className="flex items-center justify-center size-7 sm:size-9 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors group outline-none"
        title="Đăng nhập"
      >
        <UserIcon className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
      </button>
    );
  }

  // 3. Trường hợp đã đăng nhập (USER)
  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName = user?.user_metadata?.full_name || user?.email || "User";
  const initials = fullName.split(" ").pop()?.charAt(0).toUpperCase();

  return (
    <div className="relative group px-2 py-1">
      {/* Nút Avatar */}
      <button className="flex items-center gap-2 hover:opacity-80 transition-all outline-none">
        <div className="size-7 sm:size-9 rounded-full overflow-hidden flex items-center justify-center bg-purple-600 text-white font-medium border-2 border-transparent group-hover:border-zinc-400 transition-all shadow-lg">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-lg">{initials}</span>
          )}
        </div>
      </button>

      {/* Menu Dropdown */}
      <div className="absolute right-0 top-full pt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden py-2">
          {/* Thông tin User */}
          <div className="px-4 py-3 border-b border-zinc-800">
            <p className="text-sm font-semibold text-white truncate">
              {fullName}
            </p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          </div>

          {/* Các lựa chọn Menu */}
          <div className="p-1">
            <MenuLink
              href="/watchlist"
              icon={<HeartIcon className="w-5 h-5" />}
              label="Yêu thích"
            />
            <MenuLink
              href="/history"
              icon={<ClockIcon className="w-5 h-5" />}
              label="Lịch sử"
            />
            <MenuLink
              href="/profile"
              icon={<UserIcon className="w-5 h-5" />}
              label="Hồ sơ"
            />

            <hr className="my-1 border-zinc-800" />

            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors group/logout"
            >
              <ArrowLeftEndOnRectangleIcon className="w-5 h-5 group-hover/logout:-translate-x-1 transition-transform" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Giữ nguyên component con MenuLink
function MenuLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-lg transition-colors group/item"
    >
      <span className="text-zinc-500 group-hover/item:text-white transition-colors">
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
