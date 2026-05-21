"use client";

import React, { ComponentType, SVGProps, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars3Icon, XMarkIcon, ArrowLeftOnRectangleIcon } from "@heroicons/react/24/outline";
import Logo from "@/components/ui/Logo";
import UserButton from "@/components/layout/UserButton";

export type DashboardNavItem = {
  name: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export default function DashboardShell({
  children,
  navigation,
  adminNavigation,
}: {
  children: React.ReactNode;
  navigation: DashboardNavItem[];
  adminNavigation?: DashboardNavItem[];
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const currentNavigation = pathname.startsWith("/admin") && adminNavigation ? adminNavigation : navigation;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-200">
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? "block" : "hidden"}`}>
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-8 flex items-center justify-between">
            <Link href="/">
              <Logo className="h-auto w-32 sm:w-44" />
            </Link>
            <button onClick={() => setSidebarOpen(false)}>
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <DashboardNav navigation={currentNavigation} pathname={pathname} mobile />
        </div>
      </div>

      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-grow flex-col overflow-y-auto border-r border-zinc-800/50 bg-zinc-900/50 pb-4 pt-8 backdrop-blur-xl">
          <div className="mb-10 px-6">
            <Link href="/">
              <Logo className="h-auto w-32 sm:w-44" />
            </Link>
          </div>
          <DashboardNav navigation={currentNavigation} pathname={pathname} />
          <div className="mt-auto px-4">
            <button className="flex w-full items-center gap-3 px-4 py-3 font-bold text-zinc-500 transition-colors hover:text-red-500">
              <ArrowLeftOnRectangleIcon className="h-5 w-5" /> Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-zinc-800 bg-[#0a0a0c]/80 px-4 backdrop-blur-md lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="mr-4 text-zinc-400 lg:hidden">
            <Bars3Icon className="h-6 w-6" />
          </button>
          <div />
          <UserButton />
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}

function DashboardNav({
  navigation,
  pathname,
  mobile = false,
}: {
  navigation: DashboardNavItem[];
  pathname: string;
  mobile?: boolean;
}) {
  return (
    <nav className={mobile ? "flex-1 space-y-1" : "flex-1 space-y-2 px-4"}>
      {navigation.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.name}
            href={item.href}
            className={
              mobile
                ? `flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition ${active ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`
                : `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-300 ${active ? "bg-zinc-100 text-black shadow-xl" : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200"}`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
