"use client";

import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { LiveKitRoom } from "@livekit/components-react";
import { RoomOptions, VideoPresets } from "livekit-client";
import { WatchPartyRoom } from "@/types";
import { useWatchPartyStore } from "@/stores/watch-party";
import { selectParticipants, selectUser } from "@/stores/watch-party/selectors";

interface WatchPartyVoiceWrapperProps {
  room: WatchPartyRoom;
  children: React.ReactNode;
}

export default function WatchPartyVoiceWrapper({
  room,
  children,
}: WatchPartyVoiceWrapperProps) {
  const participants = useWatchPartyStore(selectParticipants);
  const user = useWatchPartyStore(selectUser);
  const wantsVoiceConnected = useWatchPartyStore(
    (state) => state.wantsVoiceConnected,
  );
  const setWantsVoiceConnected = useWatchPartyStore(
    (state) => state.setWantsVoiceConnected,
  );
  const setIsVoiceConnected = useWatchPartyStore(
    (state) => state.setIsVoiceConnected,
  );
  const [voiceToken, setVoiceToken] = useState<string | null>(null);

  // CẤU HÌNH BỘ LỌC ÂM THANH & TỐI ƯU HÓA CAMERA
  const roomOptions = useMemo<RoomOptions>(() => {
    return {
      adaptiveStream: true, // BẬT TÍNH NĂNG TỐI ƯU BĂNG THÔNG DỰA TRÊN KÍCH THƯỚC KHUNG HÌNH
      dynacast: true, // Bật dynacast để tối ưu băng thông gửi đi
      audioCaptureDefaults: {
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: true,
      },
      videoCaptureDefaults: {
        resolution: VideoPresets.h180.resolution,
        frameRate: 15,
      },
      publishDefaults: {
        videoSimulcastLayers: [VideoPresets.h180],
        videoCodec: "vp8",
      },
    };
  }, []);

  useEffect(() => {
    if (!wantsVoiceConnected) {
      setVoiceToken(null);
      setIsVoiceConnected(false);
      return;
    }

    if (!user?.id || !participants) return;
    const isMeInList = participants.some((p) => p.user_id === user.id);
    if (!isMeInList) return;

    let isMounted = true;
    const abortController = new AbortController();

    const fetchVoiceToken = async () => {
      try {
        const res = await fetch("/api/watch-party/voice-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: room.room_code,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          throw new Error("Không thể lấy Token");
        }

        const data = await res.json();
        if (isMounted && data.token) {
          setVoiceToken(data.token);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;

        if (isMounted) {
          setVoiceToken(null);
          setIsVoiceConnected(false);
          setWantsVoiceConnected(false);
          toast.error("Hệ thống Voice Chat đang gián đoạn.");
        }
      }
    };

    fetchVoiceToken();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [
    room.room_code,
    participants,
    user,
    wantsVoiceConnected,
    setIsVoiceConnected,
    setWantsVoiceConnected,
  ]);

  return (
    <LiveKitRoom
      video={false}
      audio={false}
      token={voiceToken || ""}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={!!voiceToken && wantsVoiceConnected}
      options={roomOptions}
      onConnected={() => setIsVoiceConnected(true)}
      onDisconnected={() => setIsVoiceConnected(false)}
      onError={(error) => {
        console.error("[WP_VOICE_CONNECT_ERROR]:", error);
        setVoiceToken(null);
        setIsVoiceConnected(false);
        setWantsVoiceConnected(false);
        if (wantsVoiceConnected) {
          toast.error("Không thể kết nối kênh thoại.");
        }
      }}
    >
      {children}
    </LiveKitRoom>
  );
}
