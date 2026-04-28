import { Badge } from "@/lib/badge-utils";

export default function UserBadges({ badges }: { badges: Badge[] }) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className="mt-5 flex flex-wrap gap-2 items-center relative">
      {badges.map((badge, index) => (
        <div
          key={badge.id}
          className={`group relative z-10 hover:z-50 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-300 hover:-translate-y-1 select-none cursor-help shadow-sm backdrop-blur-sm badge-animate opacity-0 ${badge.bg} ${badge.border}`}
          style={{
            animationDelay: `${index * 60}ms`,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <div
            className={`absolute inset-0 opacity-0 group-hover:opacity-40 blur-md rounded-xl transition-opacity ${badge.bg}`}
          />

          <span className="text-sm md:text-base leading-none relative z-10">
            {badge.icon}
          </span>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider relative z-10 hidden md:inline-block ${badge.color}`}
          >
            {badge.title}
          </span>

          {/* --- TOOLTIP --- */}
          <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute top-full mt-3 left-0 -translate-x-[10px] md:left-1/2 md:-translate-x-1/2 w-48 max-w-[calc(100vw-2rem)] p-3 rounded-2xl bg-zinc-950 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-all duration-200 pointer-events-none scale-90 group-hover:scale-100 origin-top">
            <div className="absolute bottom-full left-[20px] md:left-1/2 md:-translate-x-1/2 w-3 h-3 bg-zinc-950 border-l border-t border-white/10 rotate-45 -mb-1.5" />
            <div className="flex items-center gap-2 mb-1.5 text-nowrap">
              <span className="text-lg">{badge.icon}</span>
              <p className={`font-black text-[11px] uppercase ${badge.color}`}>
                {badge.title}
              </p>
            </div>
            <p className="text-zinc-400 text-[10px] leading-relaxed mb-2 font-medium italic">
              &ldquo;{badge.description}&rdquo;
            </p>
            {badge.nextThreshold && (
              <div className="pt-2 border-t border-white/5">
                <p className="text-emerald-400 text-[9px] font-bold">
                  ✨ Mục tiêu: {badge.nextThreshold}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
