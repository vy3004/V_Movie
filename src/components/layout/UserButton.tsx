"use client";

import Link from "next/link";
import {
  HeartIcon,
  ClockIcon,
  UserIcon,
  ArrowLeftEndOnRectangleIcon,
} from "@heroicons/react/24/solid";
import NotificationBell from "@/components/shared/NotificationBell";
import UserAvatar from "@/components/shared/UserAvatar";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useAuthModal } from "@/providers/AuthModalProvider";
import { useData } from "@/providers/BaseDataContextProvider";

export default function UserButton() {
  const supabase = createSupabaseClient();
  const { onOpen } = useAuthModal();

  const data = useData();
  if (!data) {
    throw new Error("UserButton must be used within BaseDataContextProvider");
  }
  const { user, authLoading } = data;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Sau khi sign out, BaseDataContextProvider sẽ tự động cập nhật lại user = null
  };

  // 1. Trạng thái đang nạp Auth (Loading)
  if (authLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="size-8 sm:size-10 rounded-full bg-zinc-800 animate-pulse" />
        <div className="size-8 sm:size-10 rounded-full bg-zinc-800 animate-pulse" />
      </div>
    );
  }

  // 2. Trường hợp chưa đăng nhập (GUEST)
  if (!user) {
    return (
      <button
        onClick={onOpen}
        className="flex items-center justify-center size-8 sm:size-10 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors group outline-none"
        title="Đăng nhập"
      >
        <UserIcon className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
      </button>
    );
  }

  // 3. Trường hợp đã đăng nhập (USER)
  const avatarUrl = user.avatar_url;
  const fullName = user.full_name || "";
  return (
    <div className="flex items-center gap-2">
      <NotificationBell />

      <div className="relative group">
        {/* Nút Avatar */}
        <button
          aria-label="Thông tin người dùng"
          className="flex items-center gap-1 hover:opacity-80 transition-all outline-none group"
        >
          <UserAvatar
            avatar_url={avatarUrl}
            user_name={fullName}
            size={40}
            className="!w-8 !h-8 sm:!w-10 sm:!h-10"
          />
        </button>

        {/* Menu Dropdown */}
        <div className="absolute right-0 top-full pt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden py-2">
            {/* Thông tin User */}
            <div className="px-4 py-2 border-b border-zinc-800">
              <Link href="/dashboard">
                <p className="text-sm font-semibold text-white truncate">
                  {fullName}
                </p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </Link>
            </div>

            {/* Các lựa chọn Menu */}
            <div className="p-1">
              <MenuLink
                href="/dashboard/subscriptions"
                icon={<HeartIcon className="w-5 h-5" />}
                label="Yêu thích"
              />
              <MenuLink
                href="/dashboard/history"
                icon={<ClockIcon className="w-5 h-5" />}
                label="Lịch sử"
              />
              <MenuLink
                href="/dashboard/profile"
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
