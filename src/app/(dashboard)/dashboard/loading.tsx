const RANDOM_HEIGHTS = [45, 75, 30, 85, 55, 65, 40];

export default function OverviewDashboardLoading() {
  return (
    <div className="space-y-8 pb-10 w-full animate-pulse">
      {/* 1. SKELETON BANNER */}
      <div className="h-[200px] md:h-[180px] bg-zinc-900/60 rounded-[2.5rem] border border-white/5" />

      {/* 2. SKELETON CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart Skeleton */}
        <div className="lg:col-span-2 h-[388px] bg-zinc-900/50 rounded-[2.5rem] border border-white/5 flex flex-col p-8">
          <div className="h-6 w-1/3 bg-zinc-800 rounded-lg mb-2" />
          <div className="h-4 w-1/2 bg-zinc-800 rounded-lg mb-auto" />
          <div className="flex gap-4 items-end h-48 mt-8">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex-1 bg-zinc-800 rounded-t-lg"
                style={{ height: `${RANDOM_HEIGHTS[i]}%` }}
              />
            ))}
          </div>
        </div>

        {/* Streak & Genre Chart Skeleton */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="h-[114px] bg-zinc-900/50 rounded-[2.5rem] border border-white/5 flex items-center p-6 gap-5">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800" />
            <div className="flex-1 space-y-3">
              <div className="h-3 w-20 bg-zinc-800 rounded-md" />
              <div className="h-8 w-32 bg-zinc-800 rounded-lg" />
            </div>
          </div>
          <div className="flex-1 min-h-[250px] bg-zinc-900/50 rounded-[2.5rem] border border-white/5 p-6 flex flex-col items-center justify-center">
            <div className="w-full h-6 bg-zinc-800 rounded-lg mb-auto self-start" />
            <div className="w-40 h-40 rounded-full border-[20px] border-zinc-800 my-auto" />
          </div>
        </div>
      </div>

      {/* 3. SKELETON HISTORY */}
      <div className="h-[280px] bg-zinc-900/40 rounded-[2.5rem] border border-white/5 p-6 lg:p-8">
        <div className="h-8 w-48 bg-zinc-800 rounded-lg mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-zinc-800 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
