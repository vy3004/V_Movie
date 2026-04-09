import {
  MoonIcon,
  SunIcon,
  HeartIcon,
  BackwardIcon,
  ForwardIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/solid";
import {
  ChatBubbleOvalLeftEllipsisIcon,
  HeartIcon as HeartOutline,
  StarIcon,
} from "@heroicons/react/24/outline";

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
}: VideoControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 mt-0 py-3 px-3 sm:px-4 rounded-b-xl">
      {/* Nút Theo dõi */}
      <button
        onClick={toggleFollow}
        disabled={isFollowLoading}
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

      {/* Nút Đánh giá */}
      <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-300 hover:text-yellow-400 hover:bg-zinc-800 rounded-lg transition">
        <StarIcon className="w-5 h-5" />
        <span className="hidden md:inline">Đánh giá</span>
      </button>

      {/* Nút Bình luận */}
      <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-300 hover:text-blue-500 hover:bg-zinc-800 rounded-lg transition">
        <ChatBubbleOvalLeftEllipsisIcon className="w-5 h-5" />
        <span className="hidden md:inline">Bình luận</span>
      </button>

      {/* Tắt/Bật Chuyển tập */}
      <button
        onClick={() => setIsAutoNext(!isAutoNext)}
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
        className="p-2 text-gray-300 hover:text-white disabled:text-gray-600 transition"
      >
        <BackwardIcon className="w-5 h-5" />
      </button>
      <button
        onClick={onNext}
        disabled={!nextEnabled}
        className="p-2 text-gray-300 hover:text-white disabled:text-gray-600 transition"
      >
        <ForwardIcon className="w-5 h-5" />
      </button>

      {/* Tắt đèn */}
      <button
        onClick={() => setIsLightsOff(!isLightsOff)}
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
