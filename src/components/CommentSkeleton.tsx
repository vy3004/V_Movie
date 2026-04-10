export default function CommentSkeleton({ number = 3 }: { number?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: number }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="size-9 shrink-0 rounded-full bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-zinc-800 rounded" />
            <div className="h-4 w-full bg-zinc-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
