"use client";

import { useState, useEffect, useRef } from "react";
import ChatMessageItem from "@/app/(main)/xem-chung/_components/ChatMessageItem";
import ChatInputForm from "@/app/(main)/xem-chung/_components/ChatInputForm";
import { useWatchParty } from "@/providers/WatchPartyProvider";

export default function ChatTab() {
  const { messages, user, room, isRealHost, myParticipant, handleSendMessage } =
    useWatchParty();

  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- TỰ ĐỘNG CUỘN XUỐNG ---
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      // Cuộn xuống đáy mỗi khi mảng messages thay đổi
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // --- KIỂM TRA QUYỀN CHAT ---
  const isDisabled =
    (!room?.settings?.guest_can_chat && !isRealHost) || myParticipant?.is_muted;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isDisabled) return;

    handleSendMessage(text);

    setText("");
    setShowEmojis(false);
  };

  const insertEmoji = (emoji: string) => {
    if (isDisabled) return;
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const stopProp = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (
      e.nativeEvent &&
      typeof e.nativeEvent.stopImmediatePropagation === "function"
    ) {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* KHU VỰC HIỂN THỊ TIN NHẮN */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
            <span className="text-3xl">🍿</span>
            <p className="text-xs italic">Bắt đầu cuộc trò chuyện...</p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.type === "system") {
            return (
              <div key={msg.id || i} className="flex justify-center my-4">
                <span className="bg-zinc-800/40 text-zinc-400 text-[10px] px-4 py-1.5 rounded-full italic border border-zinc-700/30 text-center max-w-[90%]">
                  {msg.text}
                </span>
              </div>
            );
          }

          return (
            <ChatMessageItem
              key={msg.id || i}
              msg={msg}
              isMe={msg.user_id === user?.id}
              timeString={formatTime(msg.created_at)}
            />
          );
        })}
      </div>

      {/* Ô NHẬP TIN NHẮN */}
      <div className="mt-3 relative">
        <ChatInputForm
          text={text}
          setText={setText}
          isMuted={isDisabled}
          isTyping={isTyping}
          setIsTyping={setIsTyping}
          showEmojis={showEmojis}
          setShowEmojis={setShowEmojis}
          onSubmit={handleSubmit}
          onEmojiClick={insertEmoji}
          stopProp={stopProp}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}
