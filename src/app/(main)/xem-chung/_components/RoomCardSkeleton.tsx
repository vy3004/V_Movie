export default function RoomCardSkeleton() {
  return (
    <div
      className="relative bg-[#111] rounded-xl overflow-hidden border border-white/5 animate-pulse block"
      role="status"
    >
      {/* --- PHẦN BADGES TRÊN CÙNG --- */}
      <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
        {/* Skeleton Số lượng người (Left) */}
        <div className="w-16 h-7 bg-zinc-800/80 backdrop-blur-md rounded-full border border-white/5"></div>

        {/* Skeleton Icon Private/Public (Right) */}
        <div className="w-8 h-8 bg-zinc-800/80 backdrop-blur-md rounded-full border border-white/5"></div>
      </div>

      {/* Thumbnail Area - Aspect 21/9 */}
      <div className="aspect-[21/9] w-full bg-zinc-800/40 relative overflow-hidden" />

      {/* Room Details Area */}
      <div className="p-5 space-y-4">
        {/* Skeleton Tiêu đề phòng */}
        <div className="flex items-center justify-between">
          <div className="h-4 w-3/4 bg-zinc-800 rounded-md"></div>
        </div>

        <div className="flex items-center gap-3">
          {/* Skeleton Host Avatar (size 32px = w-8 h-8) */}
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0"></div>

          {/* Skeleton Host Name */}
          <div className="flex-1 flex flex-col justify-center gap-1.5">
            <div className="h-2 w-12 bg-zinc-800 rounded-sm"></div>
            <div className="h-3 w-24 bg-zinc-800 rounded-sm"></div>
          </div>

          {/* Skeleton Nút Play */}
          <div className="h-10 w-10 rounded-full bg-zinc-800 border border-white/10 flex-shrink-0"></div>
        </div>
      </div>
      <span className="sr-only">Đang tải...</span>
    </div>
  );
}
