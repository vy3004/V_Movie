import {
  Bars3CenterLeftIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";

const EpisodeSelectorSkeleton = () => {
  return (
    <div className="bg-background p-6 rounded-xl border border-zinc-800 space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Title */}
        <div className="flex items-center gap-2">
          <Bars3CenterLeftIcon className="w-7 h-7 text-zinc-700" />
          <div className="h-6 w-36 bg-zinc-800 rounded-md"></div>
        </div>

        {/* Ô Search */}
        <div className="relative w-full sm:w-64">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <div className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-lg"></div>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="h-10 bg-zinc-800/50 rounded flex items-center justify-center min-h-[2.5rem]"
          >
            {/* Thanh bar giả lập text số tập bên trong */}
            <div className="h-3 w-10 bg-zinc-700/50 rounded-sm"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EpisodeSelectorSkeleton;
