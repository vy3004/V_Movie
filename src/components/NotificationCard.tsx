"use client";

import React, { forwardRef } from "react";
import { ChatBubbleLeftRightIcon, FilmIcon } from "@heroicons/react/24/outline";
import ImageCustom from "@/components/ImageCustom";
import { NotificationItem } from "@/types";
import { formatTimeAgo } from "@/lib/utils";

interface Props {
  noti: NotificationItem;
  variant: "toast" | "list";
  onClick?: () => void;
}

// Dùng forwardRef để có thể nhận `ref` từ Component cha (IntersectionObserver)
const NotificationCard = forwardRef<HTMLDivElement, Props>(
  ({ noti, variant, onClick }, ref) => {
    const isReply = noti.type === "comment_reply";
    const thumbUrl = noti.metadata?.thumb_url as string | undefined;

    const baseClasses =
      "relative cursor-pointer transition-all duration-300 flex items-center";

    const toastClasses = `
      ${baseClasses} w-[350px] p-4 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 shadow-2xl
      hover:bg-zinc-800 hover:scale-[1.02] active:scale-95
      border-l-4 ${isReply ? "border-l-blue-500" : "border-l-red-500"}
      animate-in fade-in slide-in-from-right-5
    `;

    const listClasses = `
      ${baseClasses} px-4 py-4 border-b border-zinc-800 last:border-0 
      hover:bg-zinc-800/80 ${noti.is_read ? "opacity-60 grayscale-[0.3]" : "bg-red-600/[0.03]"}
    `;

    return (
      <div
        ref={ref}
        className={variant === "toast" ? toastClasses : listClasses}
        onClick={onClick}
      >
        {/* DẤU CHẤM ĐỎ */}
        {!noti.is_read && (
          <div className="absolute top-3 right-3 flex size-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full size-2 bg-primary shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
          </div>
        )}

        <div className="flex items-center gap-4 w-full pr-4">
          {/* KHỐI ẢNH */}
          <div className="shrink-0">
            <div
              className={`relative ${variant === "toast" ? "size-12" : "size-11"} overflow-hidden border border-white/10 shadow-md ${
                isReply ? "rounded-full" : "rounded-lg"
              }`}
            >
              {thumbUrl ? (
                <ImageCustom
                  src={thumbUrl}
                  alt=""
                  widths={[80]}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className={`size-full flex items-center justify-center ${isReply ? "bg-blue-600/20" : "bg-red-600/20"}`}
                >
                  {isReply ? (
                    <ChatBubbleLeftRightIcon className="size-5 text-blue-400" />
                  ) : (
                    <FilmIcon className="size-5 text-red-400" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* KHỐI NỘI DUNG */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <p className="text-[14px] leading-snug text-zinc-100">
              <span className="font-bold text-white">{noti.actor_name}</span>{" "}
              <span className="text-zinc-300">{noti.content}</span>
            </p>
            <span className="text-[11px] text-zinc-500 mt-1 font-medium">
              {formatTimeAgo(noti.created_at)}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

NotificationCard.displayName = "NotificationCard";

export default NotificationCard;
