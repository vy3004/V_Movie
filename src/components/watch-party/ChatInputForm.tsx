import React from "react";
import { PaperAirplaneIcon, FaceSmileIcon } from "@heroicons/react/24/outline";

const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "🔥", "🍿", "💯"];

interface ChatInputFormProps {
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  isMuted?: boolean;
  isTyping: boolean;
  setIsTyping: React.Dispatch<React.SetStateAction<boolean>>;
  showEmojis: boolean;
  setShowEmojis: React.Dispatch<React.SetStateAction<boolean>>;
  onSubmit: (e: React.FormEvent) => void;
  onEmojiClick: (emoji: string) => void;
  stopProp: (e: React.SyntheticEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export default function ChatInputForm({
  text,
  setText,
  isMuted,
  isTyping,
  setIsTyping,
  showEmojis,
  setShowEmojis,
  onSubmit,
  onEmojiClick,
  stopProp,
  inputRef,
}: ChatInputFormProps) {
  return (
    <div className="relative">
      {/* Khay Emoji */}
      {showEmojis && !isMuted && (
        <div className="absolute bottom-full mb-3 left-0 right-0 bg-black/70 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl flex justify-around animate-in fade-in slide-in-from-bottom-2">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onEmojiClick(emoji)}
              className="!text-xl p-1.5 hover:bg-white/20 rounded-xl transition-all hover:scale-125 active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Form Chat */}
      <form
        onSubmit={onSubmit}
        className={`flex items-center gap-2 backdrop-blur-xl border border-white/10 rounded-[20px] p-2 shadow-2xl transition-all duration-300 ${isTyping ? "bg-black/60 ring-1 ring-red-500/50" : "bg-black/20 hover:bg-black/40"}`}
        onKeyDownCapture={stopProp}
        onPointerDownCapture={stopProp}
      >
        <button
          type="button"
          onClick={(e) => {
            stopProp(e);
            setShowEmojis(!showEmojis);
          }}
          disabled={isMuted}
          className="p-2.5 bg-white/5 border border-transparent rounded-2xl hover:bg-white/20 transition-colors disabled:opacity-50"
        >
          <FaceSmileIcon className="w-5 h-5 text-white/90" />
        </button>

        <div className="relative flex-1 flex items-center">
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setIsTyping(true)}
            disabled={isMuted}
            maxLength={150}
            placeholder={isMuted ? "Bị cấm chat..." : "Nhấn Enter để chat..."}
            className={`w-full bg-transparent border border-transparent rounded-2xl px-2 py-2.5 text-[14px] text-white focus:outline-none placeholder:text-white/60 disabled:opacity-50 transition-all duration-300 ${
              text.length > 100 ? "pr-[95px]" : "pr-[40px]"
            }`}
          />

          {text.length > 100 && (
            <span
              className={`absolute right-[45px] z-10 pointer-events-none text-[10px] px-1 py-0.5 rounded-md bg-black/40 backdrop-blur-md animate-in fade-in zoom-in duration-200 ${
                text.length >= 150 ? "text-red-400 font-bold" : "text-white/80"
              }`}
            >
              {text.length}/150
            </span>
          )}

          <button
            type="submit"
            disabled={isMuted || !text.trim()}
            className="absolute right-1 z-10 p-2 text-white/60 hover:text-red-500 disabled:opacity-50 transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
