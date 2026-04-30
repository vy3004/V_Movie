const MovieSectionSkeleton = () => {
  return (
    <div className="space-y-4">
      {/* 1. Header Skeleton: Tiêu đề và nút Xem thêm */}
      <div className="flex items-center justify-between">
        <div className="h-7 sm:h-8 w-40 sm:w-56 bg-zinc-900 animate-pulse rounded-md" />
        <div className="h-4 w-16 bg-zinc-900 animate-pulse rounded-md" />
      </div>

      {/* 2. Carousel Skeleton: Giả lập thanh trượt phim */}
      <div className="overflow-hidden">
        <div className="flex -ml-4">
          {/* Render 6 card để lấp đầy hàng ngang trên Desktop */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="pl-4 shrink-0 basis-[46%] sm:basis-1/3 md:basis-1/4 lg:basis-1/6 py-4"
            >
              <div className="space-y-3">
                {/* Ảnh Poster với tỉ lệ 3/4 */}
                <div className="aspect-[3/4] w-full bg-zinc-900 animate-pulse rounded-xl" />

                {/* Tên phim (2 dòng giả lập) */}
                <div className="space-y-2">
                  <div className="h-4 w-full bg-zinc-900 animate-pulse rounded" />
                  <div className="h-4 w-2/3 bg-zinc-900 animate-pulse rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MovieSectionSkeleton;
