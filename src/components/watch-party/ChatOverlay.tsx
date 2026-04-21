"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { FilmIcon, SparklesIcon } from "@heroicons/react/24/outline";
import ChatMessageItem from "@/components/watch-party/ChatMessageItem";
import ChatInputForm from "@/components/watch-party/ChatInputForm";
import { ChatMessage } from "@/types";

interface ChatOverlayProps {
  messages: ChatMessage[];
  currentUserId: string;
  isMuted?: boolean;
  onSendMessage: (msg: Partial<ChatMessage>) => void;
}

export default function ChatOverlay({
  messages,
  currentUserId,
  isMuted,
  onSendMessage,
}: ChatOverlayProps) {
  const [text, setText] = useState("");
  const [isCinematic, setIsCinematic] = useState(false);
  const [isUIActive, setIsUIActive] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [flyingMessages, setFlyingMessages] = useState<
    (ChatMessage & { uniqueKey: string })[]
  >([]);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mouseTimer = useRef<NodeJS.Timeout | null>(null);
  const prevMessagesLength = useRef(messages.length);
  const timeoutRefs = useRef<Set<NodeJS.Timeout>>(new Set());

  // LOGIC: Bắt chuột
  useEffect(() => {
    const handleMouseMove = () => {
      setIsUIActive(true);
      if (mouseTimer.current) clearTimeout(mouseTimer.current);
      if (!isTyping) {
        mouseTimer.current = setTimeout(() => setIsUIActive(false), 3000);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (mouseTimer.current) clearTimeout(mouseTimer.current);
    };
  }, [isTyping]);

  // LOGIC: Bắt phím Enter/Esc
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isCinematic) return;
      const isInputActive = document.activeElement === inputRef.current;
      if (e.key === "Enter" && !isTyping && !isInputActive) {
        e.preventDefault();
        setIsTyping(true);
        setIsUIActive(true);
      } else if (e.key === "Escape" && (isTyping || isInputActive)) {
        setIsTyping(false);
        setShowEmojis(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isTyping, isCinematic]);

  useEffect(() => {
    if (isTyping) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isTyping]);

  useEffect(() => {
    if (isUIActive || isTyping)
      endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isUIActive, isTyping]);

  // LOGIC: Tin nhắn bay
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      const newMessages = messages.slice(prevMessagesLength.current);
      if (!isUIActive && !isTyping && !isCinematic) {
        const validMsgs = newMessages.filter((m) => m.type !== "system");

        if (validMsgs.length > 0) {
          const flying = validMsgs.map((m) => ({
            ...m,
            uniqueKey: crypto.randomUUID(),
          }));

          setFlyingMessages((prev) => [...prev, ...flying]);

          flying.forEach((msg) => {
            // Đặt giờ cho TỪNG tin nhắn một
            const timer = setTimeout(() => {
              setFlyingMessages((current) =>
                current.filter((m) => m.uniqueKey !== msg.uniqueKey),
              );
              // Chạy xong thì xóa timer đó khỏi bộ nhớ
              timeoutRefs.current.delete(timer);
            }, 4000);

            // Lưu timer vào bộ nhớ an toàn
            timeoutRefs.current.add(timer);
          });
        }
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages, isUIActive, isTyping, isCinematic]);

  // Chỉ dọn dẹp các timer đang chạy dở khi component bị hủy (Unmount)
  useEffect(() => {
    const currentTimeouts = timeoutRefs.current;
    return () => {
      currentTimeouts.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isMuted) {
      onSendMessage({ text, type: "chat" });
      setText("");
    }
    inputRef.current?.blur();
    setIsTyping(false);
    setShowEmojis(false);
  };

  const insertEmoji = (emoji: string) => {
    if (isMuted) return;
    setText((prev) => prev + emoji);
    setIsTyping(true);
    inputRef.current?.focus();
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

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const hasUserMessages = useMemo(
    () => messages.some((m) => m.type !== "system"),
    [messages],
  );

  return (
    <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden">
      {/* 1. NÚT CHUYỂN CHẾ ĐỘ */}
      <div
        className={`absolute top-6 right-8 transition-all duration-500 ${isUIActive ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
      >
        <button
          onClick={(e) => {
            stopProp(e);
            setIsCinematic(!isCinematic);
          }}
          onPointerDown={stopProp}
          aria-label={isCinematic ? "Stop cinematic" : "Start cinematic"}
          className="pointer-events-auto flex p-3 !bg-background border border-white/10 rounded-full transition-all active:scale-95 shadow-xl"
        >
          {isCinematic ? (
            <FilmIcon className="w-5 h-5 text-zinc-400" />
          ) : (
            <SparklesIcon className="w-5 h-5 text-red-500" />
          )}
        </button>
      </div>

      {/* 2. TIN NHẮN BAY (IDLE) */}
      {!isCinematic &&
        !isUIActive &&
        !isTyping &&
        flyingMessages.length > 0 && (
          <div className="absolute bottom-[120px] left-8 flex flex-col items-start gap-3 w-[320px] mask-image-t">
            {flyingMessages.map((msg) => (
              <div key={msg.uniqueKey} className="w-full animate-message-fly">
                <ChatMessageItem
                  msg={msg}
                  isMe={msg.user_id === currentUserId}
                  isFlying={true}
                  isOverlay={true}
                />
              </div>
            ))}
          </div>
        )}

      {/* 3. DANH SÁCH CHAT (ACTIVE) */}
      {!isCinematic && (isUIActive || isTyping) && hasUserMessages && (
        <div className="absolute bottom-[120px] left-8 w-[320px] max-h-[50vh] flex flex-col justify-end animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
          <div
            onPointerDownCapture={stopProp}
            className="overflow-y-auto px-3 py-3 space-y-3 bg-black/10 backdrop-blur-sm [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_bottom,transparent,black_5%,black_95%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_5%,black_95%,transparent)]"
          >
            {messages.slice(-40).map((msg, i) => {
              if (msg.type === "system") return null;
              return (
                <ChatMessageItem
                  key={msg.id || i}
                  msg={msg}
                  isMe={msg.user_id === currentUserId}
                  timeString={formatTime(msg.created_at)}
                  isOverlay={true}
                />
              );
            })}
            <div ref={endRef} />
          </div>
        </div>
      )}

      {/* 4. Ô NHẬP LIỆU (FORM) */}
      {!isCinematic && (isUIActive || isTyping) && (
        <div className="absolute bottom-12 left-8 w-[320px] pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          <ChatInputForm
            text={text}
            setText={setText}
            isMuted={isMuted}
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
      )}
    </div>
  );
}
