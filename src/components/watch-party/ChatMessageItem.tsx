import { ChatMessage } from "@/types";
import UserAvatar from "../UserAvatar";

interface ChatMessageItemProps {
  msg: ChatMessage;
  isMe: boolean;
  isFlying?: boolean;
  timeString?: string;
  isOverlay?: boolean;
}

export default function ChatMessageItem({
  msg,
  isMe,
  isFlying,
  timeString,
  isOverlay,
}: ChatMessageItemProps) {
  const isSending = msg.status === "sending";
  const isError = msg.status === "error";

  const isSplit = !isOverlay && isMe;

  return (
    <div
      className={`flex gap-2.5 w-full justify-start ${isSplit ? "flex-row-reverse" : ""} ${isFlying ? "" : "px-1"} ${isSending ? "opacity-60" : "opacity-100"} transition-opacity`}
    >
      {/* CỤC AVATAR */}
      <UserAvatar
        avatar_url={msg.avatar_url}
        user_name={msg.user_name}
        size={32}
      />

      {/* KHỐI NỘI DUNG (TÊN + BONG BÓNG) */}
      <div
        className={`flex flex-col ${isSplit ? "items-end" : "items-start"} max-w-[82%]`}
      >
        {/* HEADER: TÊN + THỜI GIAN */}
        <div
          className={`flex items-center gap-2 mb-0.5 px-1 ${isSplit ? "flex-row-reverse" : ""}`}
        >
          <span
            className={`text-[10px] font-bold capitalize tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${isMe ? "text-red-300" : "text-white/80"}`}
          >
            {!isMe && msg.user_name}
          </span>
          {!isFlying && timeString && (
            <span className="text-[9px] text-white/50 drop-shadow-md">
              {isSending ? "Đang gửi..." : isError ? "Lỗi gửi" : timeString}
            </span>
          )}
        </div>

        {/* BONG BÓNG CHAT: Đuôi nhọn tự động quay theo hướng */}
        <div
          className={`max-w-full leading-relaxed break-all whitespace-pre-wrap shadow-lg border backdrop-blur-md rounded-xl ${
            isSplit ? "rounded-tr-sm" : "rounded-tl-sm"
          } ${
            isError
              ? "bg-red-950/90 text-red-100 border-red-800"
              : isMe
                ? "bg-red-600/80 border-white/20"
                : "bg-black/50 border-white/10"
          } ${msg.type === "reaction" ? "px-3.5 py-1.5" : "px-3.5 py-2 text-[14px] text-white"}`}
        >
          {msg.type === "reaction" ? (
            <span className="text-2xl drop-shadow-md leading-none">
              {msg.text}
            </span>
          ) : (
            msg.text
          )}
        </div>
      </div>
    </div>
  );
}
