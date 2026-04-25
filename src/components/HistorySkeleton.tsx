interface HistorySkeletonProps {
  showProgressText?: boolean;
}

export function HistorySkeleton({
  showProgressText = true,
}: HistorySkeletonProps) {
  return (
    <div className="space-y-2 w-full animate-pulse">
      {/* 1. Phần khung ảnh (Khớp 100% với aspect-video và rounded-lg của thẻ thật) */}
      <div className="relative aspect-video rounded-lg bg-zinc-800/50 border border-white/5" />

      {/* 2. Phần thông tin chữ bên dưới */}
      <div className="space-y-2 px-1 py-0.5">
        {/* Dòng giả lập cho Text nhỏ (Tập / Tiến trình) */}
        {showProgressText && (
          <div className="h-2.5 bg-zinc-800/60 rounded-full w-1/2" />
        )}

        {/* Dòng giả lập cho Tên phim (Hơi to và dài hơn một chút) */}
        <div className="h-3.5 bg-zinc-800/80 rounded-full w-3/4" />
      </div>
    </div>
  );
}
