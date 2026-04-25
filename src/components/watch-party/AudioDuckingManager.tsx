"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useParticipants } from "@livekit/components-react";
import Player from "video.js/dist/types/player";

interface AudioDuckingManagerProps {
  player: Player | null;
}

export default function AudioDuckingManager({
  player,
}: AudioDuckingManagerProps) {
  const lkParticipants = useParticipants();

  // Kiểm tra xem có ai đang nói không
  const isSomeoneSpeaking = useMemo(() => {
    return lkParticipants.some((p) => p.isSpeaking);
  }, [lkParticipants]);

  const [isDuckingActive, setIsDuckingActive] = useState(false);

  const duckingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Ref để biết khi nào hệ thống đang TỰ ĐỘNG chỉnh âm lượng,
  // giúp phân biệt với việc User tự kéo thanh volume.
  const isDuckingRef = useRef(false);
  const userVolumeRef = useRef<number>(1);

  // Khởi tạo userVolumeRef từ LocalStorage khi component mount
  useEffect(() => {
    const savedVol = localStorage.getItem("v_movie_volume");
    const parsed = Number(savedVol);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      userVolumeRef.current = parsed;
    }
  }, []);

  // 1. Lắng nghe hành động tự chỉnh Volume của người dùng
  useEffect(() => {
    if (!player) return;

    const handleVolumeChange = () => {
      // Chỉ lưu âm lượng vào localStorage & Ref khi user CHỦ ĐỘNG kéo thanh volume
      if (!isDuckingRef.current) {
        const newVol = player.volume() ?? 1;
        userVolumeRef.current = newVol; // Cập nhật lại gốc
        localStorage.setItem("v_movie_volume", String(newVol));
      }
    };

    player.on("volumechange", handleVolumeChange);
    return () => {
      player.off("volumechange", handleVolumeChange);
    };
  }, [player]);

  // 2. BỘ LỌC CHẬP CHỜN (HOLD TIME)
  useEffect(() => {
    if (isSomeoneSpeaking) {
      // Đang nói -> Bật giảm âm lượng NGAY LẬP TỨC
      setIsDuckingActive(true);
      // Hủy bỏ lệnh chờ tăng âm lượng (nếu có)
      if (duckingTimeoutRef.current) clearTimeout(duckingTimeoutRef.current);
    } else {
      // Ngừng nói -> CHỜ 1.5 GIÂY (1500ms) rồi mới cho phép tăng âm lượng
      duckingTimeoutRef.current = setTimeout(() => {
        setIsDuckingActive(false);
      }, 1500);
    }

    return () => {
      if (duckingTimeoutRef.current) clearTimeout(duckingTimeoutRef.current);
    };
  }, [isSomeoneSpeaking]);

  // 3. EFFECT ĐIỀU CHỈNH ÂM LƯỢNG MƯỢT MÀ
  useEffect(() => {
    if (!player || player.isDisposed()) return;

    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

    // Khai báo biến để giữ timeout, giúp ta dọn dẹp nó khi Effect re-run hoặc unmount
    let resetDuckingTimeout: NodeJS.Timeout | null = null;

    const baseVol = userVolumeRef.current;
    // Khi có người nói, giảm còn 70% âm lượng gốc
    const targetVolume = isDuckingActive ? baseVol * 0.7 : baseVol;

    const step = 0.01;
    const duration = 20;

    isDuckingRef.current = true;

    fadeIntervalRef.current = setInterval(() => {
      const currentVol = player.volume();

      if (currentVol === undefined) {
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        return;
      }

      if (Math.abs(currentVol - targetVolume) <= step) {
        player.volume(targetVolume);
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

        if (!isDuckingActive) {
          resetDuckingTimeout = setTimeout(() => {
            isDuckingRef.current = false;
          }, 100);
        }
      } else {
        const nextVol =
          currentVol > targetVolume
            ? Math.max(0, currentVol - step)
            : Math.min(1, currentVol + step);
        player.volume(nextVol);
      }
    }, duration);

    // Hàm Cleanup của useEffect (Chạy khi component unmount hoặc isDuckingActive/player thay đổi)
    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      if (resetDuckingTimeout) clearTimeout(resetDuckingTimeout);
    };
  }, [isDuckingActive, player]);

  return null;
}
