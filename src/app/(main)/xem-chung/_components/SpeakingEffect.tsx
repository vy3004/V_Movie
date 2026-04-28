"use client";

import React from "react";
import { MicrophoneIcon } from "@heroicons/react/24/solid";

interface SpeakingEffectProps {
  isSpeaking: boolean;
  isMicEnabled?: boolean;
  hideIcon?: boolean;
  pulseColor?: "emerald" | "rose";
  children: React.ReactNode;
  size?: number;
}

const colorMap = {
  emerald: { glow: "bg-emerald-500", ring: "border-emerald-500" },
  rose: { glow: "bg-rose-500", ring: "border-rose-500" },
};

export default function SpeakingEffect({
  isSpeaking,
  isMicEnabled = false,
  hideIcon = false,
  pulseColor = "emerald",
  children,
  size = 40,
}: SpeakingEffectProps) {
  const colors = colorMap[pulseColor];

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {/* 1. HIỆU ỨNG SÓNG ÂM (Chỉ hiện khi đang nói) */}
      {isSpeaking && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div
            className={`absolute -inset-4 rounded-full blur-lg animate-voice-glow opacity-30 ${colors.glow}`}
          />
          <div
            className={`absolute -inset-1.5 rounded-full border-[2px] animate-voice-ring opacity-70 ${colors.ring}`}
          />
        </div>
      )}

      {/* 2. ICON MICRO ĐÃ MỞ (Hiện ở góc trên bên trái) */}
      {!hideIcon && isMicEnabled && (
        <div
          aria-hidden="true"
          className="absolute -top-1 -left-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 border-2 border-[#0a0a0c] flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.6)] z-20 transition-all duration-300 animate-in zoom-in"
        >
          <MicrophoneIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
        </div>
      )}

      {/* 3. NỘI DUNG CHÍNH (UserAvatar hoặc VideoTrack) */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
