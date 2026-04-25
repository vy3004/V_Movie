"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  ClockIcon,
  HeartIcon,
  UserIcon,
  BellIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowLeftOnRectangleIcon,
} from "@heroicons/react/24/outline";
import Logo from "@/components/Logo";
import UserButton from "@/components/UserButton";

const navigation = [
  { name: "Tổng quan", href: "/dashboard", icon: HomeIcon },
  { name: "Lịch sử xem", href: "/dashboard/history", icon: ClockIcon },
  { name: "Phim yêu thích", href: "/dashboard/subscriptions", icon: HeartIcon },
  { name: "Thông báo", href: "/dashboard/notifications", icon: BellIcon },
  { name: "Cá nhân", href: "/dashboard/profile", icon: UserIcon },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-200">
      {/* MOBILE SIDEBAR */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? "block" : "hidden"}`}
      >
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="fixed inset-y-0 left-0 w-64 bg-zinc-900 border-r border-zinc-800 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <Link href={"/"}>
              <Logo className="h-auto w-32 sm:w-44" />
            </Link>
            <button onClick={() => setSidebarOpen(false)}>
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition ${pathname === item.href ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "hover:bg-zinc-800 text-zinc-400 hover:text-white"}`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* DESKTOP SIDEBAR */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-zinc-900/50 border-r border-zinc-800/50 pt-8 pb-4 overflow-y-auto backdrop-blur-xl">
          <div className="px-6 mb-10">
            <Link href={"/"}>
              <Logo className="h-auto w-32 sm:w-44" />
            </Link>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${pathname === item.href ? "bg-zinc-100 text-black shadow-xl" : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"}`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="px-4 mt-auto">
            <button className="flex items-center gap-3 w-full px-4 py-3 text-zinc-500 font-bold hover:text-red-500 transition-colors">
              <ArrowLeftOnRectangleIcon className="w-5 h-5" /> Đăng xuất
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* TÍCH HỢP HEADER TẠI ĐÂY */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 lg:px-6 bg-[#0a0a0c]/80 backdrop-blur-md border-b border-zinc-800">
          <div>
            {/* Hamburger cho Mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-zinc-400 lg:hidden mr-4"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
          </div>

          <UserButton />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
