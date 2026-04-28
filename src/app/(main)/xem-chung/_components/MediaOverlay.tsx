"use client";

import React, { useEffect, useState, useMemo, useRef, memo } from "react";
import { useParticipants, VideoTrack } from "@livekit/components-react";
import { Track, Participant } from "livekit-client";
import UserAvatar from "@/components/shared/UserAvatar";
import SpeakingEffect from "@/app/(main)/xem-chung/_components/SpeakingEffect";
import { useWatchParty } from "@/providers/WatchPartyProvider";
import { WatchPartyParticipant } from "@/types";

export default function MediaOverlay() {
  const { participants } = useWatchParty();
  const lkParticipants = useParticipants();

  // Danh sách ID những người đang nói hoặc vừa mới nói xong (grace period)
  const [recentSpeakerIds, setRecentSpeakerIds] = useState<string[]>([]);
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});

  // 1. QUẢN LÝ LOGIC HIỂN THỊ ĐỘNG (FADE IN/OUT CHO VOICE)
  // Chỉ dọn dẹp bộ nhớ khi Component bị unmount (rời phòng)
  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(clearTimeout);
      timeoutRefs.current = {}; // Xóa sạch dấu vết
    };
  }, []);

  useEffect(() => {
    const currentTimeouts = timeoutRefs.current;

    // Lấy ID những người ĐANG nói lúc này
    const currentlySpeakingIds = lkParticipants
      .filter((p) => p.isSpeaking)
      .map((p) => p.identity);

    // 1.1 Xử lý người đang nói
    currentlySpeakingIds.forEach((id) => {
      setRecentSpeakerIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

      // Nếu họ đang nói mà có lệnh "chuẩn bị xóa" thì hủy ngay lệnh đó
      if (currentTimeouts[id]) {
        clearTimeout(currentTimeouts[id]);
        delete currentTimeouts[id]; // Xóa luôn key cho sạch sẽ
      }
    });

    // 1.2 Xử lý người vừa ngưng nói
    recentSpeakerIds.forEach((id) => {
      if (!currentlySpeakingIds.includes(id) && !currentTimeouts[id]) {
        currentTimeouts[id] = setTimeout(() => {
          setRecentSpeakerIds((prev) => prev.filter((sid) => sid !== id));
          delete currentTimeouts[id]; // Chạy xong thì tự xóa key
        }, 1500);
      }
    });
  }, [lkParticipants, recentSpeakerIds]);

  // 2. TÍNH TOÁN DANH SÁCH HIỂN THỊ CUỐI CÙNG (CỐ ĐỊNH CAM + ĐỘNG VOICE)
  const displayParticipants = useMemo(() => {
    return lkParticipants
      .map((lp) => {
        const cameraPub = lp.getTrackPublication(Track.Source.Camera);
        const hasCamera = !!cameraPub && !cameraPub.isMuted;
        const isSpeakingOrRecent = recentSpeakerIds.includes(lp.identity);

        // Chỉ hiển thị nếu: Đang mở Cam HOẶC (Đang nói/Vừa nói xong)
        if (hasCamera || isSpeakingOrRecent) {
          return {
            id: lp.identity,
            hasCamera,
            isSpeaking: lp.isSpeaking,
            lkParticipant: lp,
          };
        }
        return null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .slice(0, 5); // Giới hạn tối đa 5 người để đảm bảo hiệu năng và diện tích
  }, [lkParticipants, recentSpeakerIds]);

  if (displayParticipants.length === 0) return null;

  return (
    <div className="absolute top-6 left-8 z-[110] flex items-start gap-4 pointer-events-none">
      {displayParticipants.map((p) => (
        <ParticipantMediaItem
          key={p.id}
          hasCamera={p.hasCamera}
          isSpeaking={p.isSpeaking}
          lkParticipant={p.lkParticipant}
          dbUser={participants.find((u) => u.user_id === p.id)}
        />
      ))}
    </div>
  );
}

interface ParticipantMediaItemProps {
  hasCamera: boolean;
  isSpeaking: boolean;
  lkParticipant: Participant;
  dbUser?: WatchPartyParticipant;
}

// COMPONENT CON ĐỂ TỐI ƯU RE-RENDER
const ParticipantMediaItem = memo(
  ({
    hasCamera,
    isSpeaking,
    lkParticipant,
    dbUser,
  }: ParticipantMediaItemProps) => {
    const cameraTrack = lkParticipant.getTrackPublication(Track.Source.Camera);

    // Logic trackRef để VideoTrack hoạt động
    const trackRef = useMemo(() => {
      if (!hasCamera || !cameraTrack) return null;
      return {
        participant: lkParticipant,
        publication: cameraTrack,
        source: Track.Source.Camera,
      };
    }, [hasCamera, lkParticipant, cameraTrack]);

    return (
      <div className="flex flex-col items-center gap-2 animate-in slide-in-from-left-4 fade-in duration-300">
        <SpeakingEffect
          isSpeaking={isSpeaking}
          size={44}
          hideIcon={true}
          pulseColor={"emerald"}
        >
          {hasCamera && trackRef ? (
            <div className="w-full h-full rounded-full overflow-hidden border-2 border-emerald-500 shadow-lg bg-zinc-900">
              <VideoTrack
                trackRef={trackRef}
                className="w-full h-full object-cover transform -scale-x-100"
              />
            </div>
          ) : (
            <UserAvatar
              avatar_url={dbUser?.profiles?.avatar_url}
              user_name={dbUser?.profiles?.full_name || "Thành viên"}
              size={44}
            />
          )}
        </SpeakingEffect>

        {/* Tên hiển thị nhỏ gọn bên dưới */}
        <div className="px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-full border border-white/5">
          <p className="text-[10px] font-bold text-white whitespace-nowrap">
            {dbUser?.profiles?.full_name?.split(" ").pop() || "Thành viên"}
          </p>
        </div>
      </div>
    );
  },
);

ParticipantMediaItem.displayName = "ParticipantMediaItem";
