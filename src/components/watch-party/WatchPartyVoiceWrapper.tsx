"use client";

import React, { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { LiveKitRoom } from "@livekit/components-react";
import { RoomOptions, VideoPresets } from "livekit-client";
import { WatchPartyRoom } from "@/types";

interface WatchPartyVoiceWrapperProps {
  room: WatchPartyRoom;
  children: React.ReactNode;
}

export default function WatchPartyVoiceWrapper({
  room,
  children,
}: WatchPartyVoiceWrapperProps) {
  const [voiceToken, setVoiceToken] = useState<string | null>(null);

  // CẤU HÌNH BỘ LỌC ÂM THANH & TỐI ƯU HÓA CAMERA
  const roomOptions = useMemo<RoomOptions>(() => {
    return {
      adaptiveStream: true, // BẬT TÍNH NĂNG TỐI ƯU BĂNG THÔNG DỰA TRÊN KÍCH THƯỚC KHUNG HÌNH
      dynacast: true, // Bật dynacast để tối ưu băng thông gửi đi
      audioCaptureDefaults: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
      videoCaptureDefaults: {
        // Ép độ phân giải xuống mức cực thấp (160x120 hoặc 320x180) vì chỉ render khung nhỏ
        // Hỗ trợ tốt cho trường hợp mạng yếu khi xem phim
        resolution: VideoPresets.h180.resolution,
      },
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchVoiceToken = async () => {
      try {
        const res = await fetch("/api/watch-party/voice-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: room.room_code,
          }),
        });

        if (!res.ok) {
          throw new Error("Không thể lấy Token");
        }

        const data = await res.json();
        if (isMounted && data.token) setVoiceToken(data.token);
      } catch {
        toast.error("Hệ thống Voice Chat đang gián đoạn.");
      }
    };

    fetchVoiceToken();

    return () => {
      isMounted = false;
    };
  }, [room.room_code]); // Chỉ phụ thuộc vào mã phòng

  return (
    <LiveKitRoom
      video={false} // Khởi tạo ban đầu là tắt (Người dùng tự bật qua TrackToggle)
      audio={false} // Khởi tạo ban đầu là tắt (Người dùng tự bật qua TrackToggle)
      token={voiceToken || ""}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={!!voiceToken}
      options={roomOptions}
    >
      {children}
    </LiveKitRoom>
  );
}
