import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  FireIcon,
  PlayCircleIcon,
} from "@heroicons/react/24/outline";

// --- SERVICES & UTILS ---
import { DashboardService } from "@/services/dashboard.service";
import { HistoryService } from "@/services/history.service";
import { createSupabaseServer } from "@/lib/supabase/server";
import { calculateUserBadges } from "@/lib/badge-utils";
import { getRandomGreeting } from "@/lib/utils";
import { HistoryItem } from "@/types";

// --- COMPONENTS ---
import HistoryCard from "@/components/shared/HistoryCard";
import UserBadges from "@/components/shared/UserBadges";

// --- DYNAMIC IMPORTS ---
const ActivityChart = dynamic(
  () => import("@/app/(dashboard)/dashboard/_components/ActivityChart"),

  {
    ssr: false,

    loading: () => (
      <div className="lg:col-span-2 h-[388px] bg-zinc-900/50 rounded-[2.5rem] border border-white/5 flex flex-col p-8 animate-pulse">
        <div className="h-6 w-1/3 bg-zinc-800 rounded-lg mb-2" />

        <div className="h-4 w-1/2 bg-zinc-800 rounded-lg mb-auto" />

        <div className="flex gap-4 items-end h-48 mt-8">
          {[45, 75, 30, 85, 55, 65, 40].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-zinc-800 rounded-t-lg"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    ),
  },
);

const GenreChart = dynamic(
  () => import("@/app/(dashboard)/dashboard/_components/GenreChart"),
  {
    ssr: false,

    loading: () => (
      <div className="flex-1 min-h-[250px] bg-zinc-900/50 rounded-[2.5rem] border border-white/5 p-6 flex flex-col items-center justify-center animate-pulse">
        <div className="w-full h-6 bg-zinc-800 rounded-lg mb-auto self-start" />

        <div className="w-40 h-40 rounded-full border-[20px] border-zinc-800 my-auto" />
      </div>
    ),
  },
);

// --- CONSTANTS ---
const DEFAULT_ACTIVITY = [
  { day: "T2", hours: 0 },
  { day: "T3", hours: 0 },
  { day: "T4", hours: 0 },
  { day: "T5", hours: 0 },
  { day: "T6", hours: 0 },
  { day: "T7", hours: 0 },
  { day: "CN", hours: 0 },
];
const DEFAULT_GENRE = [{ name: "Chưa có", value: 100, color: "#3f3f46" }];

export default async function OverviewPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // --- XỬ LÝ FETCH DATA VỚI ERROR HANDLING ---
  let stats = null;
  let recentHistory: HistoryItem[] = [];

  try {
    const [statsData, historyResult] = await Promise.all([
      DashboardService.getStats(user.id),
      HistoryService.getListPaginated({
        userId: user.id,
        limit: 4,
        filter: "watching",
      }),
    ]);
    stats = statsData;
    recentHistory = historyResult?.data || [];
  } catch (error) {
    console.error("[OverviewPage_Fetch_Error]:", error);
  }

  // Khởi tạo các biến hiển thị (Fallback an toàn)
  const activityData = stats?.activityData?.length
    ? stats.activityData
    : DEFAULT_ACTIVITY;
  const genreData = stats?.genreData?.length ? stats.genreData : DEFAULT_GENRE;
  const totalHours = stats?.totalHours || 0;
  const streakDays = stats?.streakDays || 0;
  const growth = stats?.growthPercentage || 0;
  const isPositive = growth >= 0;

  const userBadges = calculateUserBadges({ totalHours, streakDays, genreData });
  const greeting = getRandomGreeting(new Date().getHours());
  const displayName =
    user.user_metadata?.full_name?.split(" ")[0] || "Mọt Phim";

  return (
    <div className="space-y-8 pb-10">
      {/* 1. BANNER */}
      <div className="relative flex flex-col md:flex-row justify-between gap-6 bg-zinc-900/40 p-5 md:p-8 rounded-[2.5rem] border border-white/5 transition-all hover:bg-zinc-900/60 z-10 overflow-visible">
        <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none z-0">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-red-600/20 blur-[120px] rounded-full transition-transform duration-1000" />
        </div>

        <div className="relative z-50 flex-1">
          <h1 className="text-2xl lg:text-3xl font-black text-white">
            {greeting}, <span className="text-red-500">{displayName}!</span>
          </h1>

          <UserBadges badges={userBadges} />
        </div>

        <div className="relative z-10 h-fit bg-black/20 backdrop-blur-md p-5 rounded-3xl border border-white/5">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            Tổng thời lượng{" "}
            {isPositive ? (
              <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-500" />
            ) : (
              <ArrowTrendingDownIcon className="w-4 h-4 text-rose-500" />
            )}
          </p>
          <div className="flex items-baseline gap-3">
            <div className="text-5xl font-black text-white leading-none tracking-tight">
              {totalHours}{" "}
              <span className="text-lg text-zinc-500 ml-1 font-bold">Giờ</span>
            </div>
            <span
              className={`text-xs font-bold px-2 py-1 rounded-lg ${
                isPositive
                  ? "text-emerald-500 bg-emerald-500/10"
                  : "text-rose-500 bg-rose-500/10"
              }`}
            >
              {isPositive ? "+" : ""}
              {growth}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. THỐNG KÊ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ActivityChart data={activityData} />

        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Card Chuỗi Ngày */}
          <div className="bg-zinc-900/30 backdrop-blur-xl p-6 rounded-[2.5rem] flex items-center gap-5 border border-white/5">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500/20 to-red-500/5 rounded-2xl flex items-center justify-center border border-orange-500/20">
              <FireIcon
                className={`w-8 h-8 ${streakDays > 0 ? "text-orange-500" : "text-zinc-600"}`}
              />
            </div>
            <div>
              <p className="text-zinc-500 text-[11px] font-black uppercase tracking-widest">
                Chuỗi ngày
              </p>
              <h3 className="text-3xl font-black text-white mt-1 tracking-tighter">
                {streakDays} Ngày
              </h3>
            </div>
          </div>
          <GenreChart data={genreData} />
        </div>
      </div>

      {/* 3. LỊCH SỬ */}
      <div className="bg-zinc-900/20 p-6 lg:p-8 rounded-[2.5rem] border border-white/5">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <PlayCircleIcon className="w-6 h-6 text-red-500" /> Xem dang dở
        </h2>
        {recentHistory.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentHistory.map((item) => (
              <HistoryCard
                key={item.id || item.movie_slug}
                item={item}
                type="watching"
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-700 text-zinc-500 font-medium">
            Chưa có phim nào đang xem... 🍿
          </div>
        )}
      </div>
    </div>
  );
}
