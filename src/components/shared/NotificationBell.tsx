"use client";

import React, { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { BellIcon } from "@heroicons/react/24/outline";
import { useNotifications } from "@/providers/NotificationProvider";

const NotificationDropdown = dynamic(() => import("./NotificationDropdown"), {
  ssr: false,
});

export default function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Thông báo"
        aria-expanded={isOpen}
        aria-haspopup="true"
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

      {isOpen && (
        <NotificationDropdown setIsOpen={setIsOpen} bellRef={bellRef} />
      )}
    </div>
  );
}
