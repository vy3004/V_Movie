import {
  MoonIcon,
  SunIcon,
  HeartIcon,
  BackwardIcon,
  ForwardIcon,
  ArrowsRightLeftIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";
import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline";
import { useState } from "react";

interface VideoControlsProps {
  isFollowed: boolean;
  isFollowLoading: boolean;
  toggleFollow: () => void;
  isAutoNext: boolean;
  setIsAutoNext: (v: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
  prevEnabled: boolean;
  nextEnabled: boolean;
  isLightsOff: boolean;
  setIsLightsOff: (v: boolean) => void;
  isWatchParty?: boolean;
  onManualSync?: () => void;
}

export default function VideoControls({
  isFollowed,
  isFollowLoading,
  toggleFollow,
  isAutoNext,
  setIsAutoNext,
  onPrev,
  onNext,
  prevEnabled,
  nextEnabled,
  isLightsOff,
  setIsLightsOff,
  isWatchParty,
  onManualSync,
}: VideoControlsProps) {
  // Thêm state để quay icon 1 giây tạo cảm giác (Feedback)
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncClick = () => {
    if (onManualSync) {
      onManualSync();
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };
  return (
    <div className="flex items-center justify-around gap-3 sm:gap-4 mt-0 py-3 px-3 sm:px-4 rounded-b-xl">
      {/* Nút Theo dõi */}
      <button
        onClick={toggleFollow}
        disabled={isFollowLoading}
        aria-label={isFollowed ? "Bỏ theo dõi" : "Theo dõi"}
        title={isFollowed ? "Bỏ theo dõi" : "Theo dõi"}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm rounded-lg transition ${isFollowed ? "text-red-400 hover:bg-zinc-800" : "text-gray-300 hover:text-red-400 hover:bg-zinc-800"}`}
      >
        {isFollowed ? (
          <HeartIcon className="w-5 h-5" />
        ) : (
          <HeartOutline className="w-5 h-5" />
        )}
        <span className="hidden md:inline">
          {isFollowed ? "Đã theo dõi" : "Theo dõi"}
        </span>
      </button>
      {/* Tắt/Bật Chuyển tập */}
      <button
        onClick={() => setIsAutoNext(!isAutoNext)}
        aria-label="Chuyển tập"
        title="Chuyển tập"
        className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition ${isAutoNext ? "text-green-400 hover:bg-zinc-800" : "text-gray-500 hover:bg-zinc-800"}`}
      >
        <ArrowsRightLeftIcon className="w-5 h-5" />
        <span className="hidden md:inline">Chuyển tập</span>
        <span className="md:hidden text-[10px] font-bold">
          {isAutoNext ? "ON" : "OFF"}
        </span>
      </button>
      {/* Điều hướng tập */}
      <button
        onClick={onPrev}
        disabled={!prevEnabled}
        aria-label="Tập trước"
        title="Tập trước"
        className="p-2 text-gray-300 hover:text-white disabled:text-gray-600 transition"
      >
        <BackwardIcon className="w-5 h-5" />
      </button>
      <button
        onClick={onNext}
        disabled={!nextEnabled}
        aria-label="Tập tiếp theo"
        title="Tập tiếp theo"
        className="p-2 text-gray-300 hover:text-white disabled:text-gray-600 transition"
      >
        <ForwardIcon className="w-5 h-5" />
      </button>

      {/* 👑 NÚT SYNC THỦ CÔNG (CHỈ HIỆN TRONG WATCH PARTY) */}
      {isWatchParty && (
        <button
          onClick={handleSyncClick}
          title="Đồng bộ lại Video"
          aria-label="Đồng bộ lại Video"
          className="p-2 text-blue-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
        >
          <ArrowPathIcon className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
        </button>
      )}

      {/* Tắt đèn */}
      <button
        onClick={() => setIsLightsOff(!isLightsOff)}
        aria-label={isLightsOff ? "Bật đèn" : "Tắt đèn"}
        title={isLightsOff ? "Bật đèn" : "Tắt đèn"}
        className="p-2 text-gray-300 hover:text-white transition"
      >
        {isLightsOff ? (
          <SunIcon className="w-5 h-5 text-yellow-400" />
        ) : (
          <MoonIcon className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
