"use client";

import React from "react";
import {
  BellIcon,
  CircleStackIcon,
  ClockIcon,
  HeartIcon,
  HomeIcon,
  QueueListIcon,
  RectangleStackIcon,
  ServerStackIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import DashboardShell, { DashboardNavItem } from "@/app/(dashboard)/dashboard/_components/DashboardShell";

const navigation: DashboardNavItem[] = [
  { name: "Tổng quan", href: "/dashboard", icon: HomeIcon },
  { name: "Lịch sử xem", href: "/dashboard/history", icon: ClockIcon },
  { name: "Phim yêu thích", href: "/dashboard/subscriptions", icon: HeartIcon },
  { name: "Thông báo", href: "/dashboard/notifications", icon: BellIcon },
  { name: "Cá nhân", href: "/dashboard/profile", icon: UserIcon },
];

const adminNavigation: DashboardNavItem[] = [
  { name: "Sync", href: "/admin/sync", icon: ServerStackIcon },
  { name: "Movies", href: "/admin/movies", icon: CircleStackIcon },
  { name: "Collections", href: "/admin/collections", icon: RectangleStackIcon },
  { name: "Review Queue", href: "/admin/reviews", icon: QueueListIcon },
  { name: "Merge Log", href: "/admin/merge-log", icon: ClockIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell navigation={navigation} adminNavigation={adminNavigation}>
      {children}
    </DashboardShell>
  );
}
