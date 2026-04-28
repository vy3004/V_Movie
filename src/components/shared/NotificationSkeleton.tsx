"use client";

import React from "react";

interface Props {
  variant?: "toast" | "list";
}

export default function NotificationSkeleton({ variant = "list" }: Props) {
  const isToast = variant === "toast";

  const baseClasses =
    "relative flex items-center gap-4 w-full animate-pulse cursor-default";

  const toastClasses = `
    ${baseClasses} w-[350px] p-4 rounded-2xl bg-zinc-900/95 border border-zinc-800
  `;

  const listClasses = `
    ${baseClasses} px-4 py-4 border-b border-zinc-800 last:border-0 bg-transparent
  `;

  return (
    <div
      className={isToast ? toastClasses : listClasses}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Đang tải thông báo"
    >
      {/* Khối Ảnh giả lập */}
      <div className="shrink-0">
        <div
          className={`bg-zinc-800/80 ${
            isToast ? "size-12 rounded-full" : "size-11 rounded-lg"
          }`}
        />
      </div>

      {/* Khối Text giả lập */}
      <div className="flex-1 min-w-0 flex flex-col justify-center space-y-2.5 py-1">
        {/* Dòng title dài */}
        <div className="h-3.5 bg-zinc-800/80 rounded-md w-3/4" />
        {/* Dòng thời gian ngắn */}
        <div className="h-2.5 bg-zinc-800/50 rounded-md w-1/4" />
      </div>
    </div>
  );
}
