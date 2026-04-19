import React, { useState, useEffect, useRef } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { User } from "@supabase/supabase-js";
import { WatchPartyRoom } from "@/types/watch-party";

export interface ChatMessage {
  user_id: string;
  user_name: string;
  text: string;
}

interface ChatTabProps {
  messages: ChatMessage[];
  user: User;
  room: WatchPartyRoom;
  isHost: boolean;
  onSendMessage: (msg: ChatMessage) => void;
}

export default function ChatTab({ messages, user, room, isHost, onSendMessage }: ChatTabProps) {
  const [chatMessage, setChatMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || (!room.settings?.guest_can_chat && !isHost)) return;

    const newMsg: ChatMessage = {
      user_id: user.id,
      user_name: user.user_metadata?.full_name || "Guest",
      text: chatMessage,
    };

    onSendMessage(newMsg);
    setChatMessage("");
  };

  const isDisabled = !room.settings?.guest_can_chat && !isHost;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-zinc-700 text-xs italic">
            Bắt đầu cuộc trò chuyện...
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.user_id === user.id ? "items-end" : "items-start"}`}>
            <span className="text-[10px] text-zinc-500 mb-1 px-1">{msg.user_name}</span>
            <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[85%] ${msg.user_id === user.id ? "bg-red-600 text-white rounded-tr-none" : "bg-zinc-800 text-zinc-300 rounded-tl-none border border-zinc-700/50"}`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          placeholder={isDisabled ? "Chat đang bị khóa" : "Nhắn gì đó..."}
          disabled={isDisabled}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-red-600 disabled:opacity-50"
        />
        <button disabled={isDisabled} type="submit" className="bg-red-600 p-3 rounded-2xl hover:bg-red-700 transition active:scale-95 disabled:opacity-50">
          <PaperAirplaneIcon className="w-5 h-5 text-white" />
        </button>
      </form>
    </div>
  );
}