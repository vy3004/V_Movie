"use client";

import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  ChartBarIcon,
  TrophyIcon,
  FireIcon,
  ChartPieIcon,
  PlayCircleIcon,
} from "@heroicons/react/24/outline";
import HistoryCard from "@/components/HistoryCard";
import { useHistoryList } from "@/hooks/useHistory";

// --- DỮ LIỆU MOCK (Sau này thay bằng API) ---
const activityData = [
  { day: "T2", hours: 2 },
  { day: "T3", hours: 1.5 },
  { day: "T4", hours: 3 },
  { day: "T5", hours: 1 },
  { day: "T6", hours: 4 },
  { day: "T7", hours: 8 },
  { day: "CN", hours: 6 },
];

const genreData = [
  { name: "Hành Động", value: 35, color: "#ef4444" }, // Red
  { name: "Tình Cảm", value: 25, color: "#ec4899" }, // Pink
  { name: "Kinh Dị", value: 15, color: "#f59e0b" }, // Amber
  { name: "Khoa Học", value: 15, color: "#10b981" }, // Emerald
  { name: "Khác", value: 10, color: "#71717a" }, // Zinc
];

export default function OverviewPage() {
  // Lấy dữ liệu lịch sử thật từ hook của bạn
  const { historyList } = useHistoryList();

  // Chỉ lấy 4 phim xem gần nhất cho phần Tổng quan
  const recentHistory = historyList.slice(0, 4);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      {/* 1. BANNER THÀNH TỰU & TỔNG QUAN */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gradient-to-r from-red-600/20 via-zinc-900/50 to-transparent p-8 rounded-[2.5rem] border border-red-500/20 relative overflow-hidden">
        {/* Glow effect background */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-red-600/20 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10">
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white">
            Chào Mọt Phim!
          </h1>
          <p className="text-zinc-400 mt-2 flex items-center gap-2 text-sm lg:text-base">
            <TrophyIcon className="w-6 h-6 text-amber-500" />
            Danh hiệu:{" "}
            <span className="font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded-lg">
              Cú Đêm Cày Phim
            </span>
          </p>
        </div>
        <div className="relative z-10 text-left">
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-1">
            Tổng thời lượng
          </p>
          <p className="text-5xl font-black text-white leading-none">
            128<span className="text-xl text-zinc-500 ml-1">Giờ</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. BIỂU ĐỒ HOẠT ĐỘNG (Chiếm 2 cột) */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ChartBarIcon className="w-6 h-6 text-emerald-500" /> Hoạt động
                trong tuần
              </h2>
              <p className="text-zinc-500 text-sm mt-1">
                Số giờ bạn đắm chìm vào thế giới điện ảnh.
              </p>
            </div>
          </div>

          <div className="h-64 w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activityData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#71717a", fontSize: 12, fontWeight: "bold" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#71717a", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "#27272a", opacity: 0.4 }}
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "16px",
                    fontWeight: "bold",
                  }}
                  itemStyle={{ color: "#ef4444" }}
                  formatter={(value) => [`${value} Giờ`, "Thời gian"]}
                />
                <Bar dataKey="hours" radius={[6, 6, 6, 6]}>
                  {activityData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.hours ===
                        Math.max(...activityData.map((d) => d.hours))
                          ? "#ef4444"
                          : "#3f3f46"
                      }
                      className="transition-all duration-300 hover:opacity-80"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. CỘT BÊN PHẢI: CHUỖI NGÀY & KHẨU VỊ */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Chuỗi ngày */}
          <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2.5rem] flex items-center gap-6">
            <div className="w-20 h-20 bg-orange-500/10 rounded-full flex shrink-0 items-center justify-center">
              <FireIcon className="w-10 h-10 text-orange-500" />
            </div>
            <div>
              <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">
                Chuỗi cày phim
              </p>
              <h3 className="text-3xl font-black text-white mt-1">5 Ngày</h3>
            </div>
          </div>

          {/* Biểu đồ Khẩu vị (Donut Chart) */}
          <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2.5rem] flex-1 flex flex-col">
            <div className="mb-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ChartPieIcon className="w-5 h-5 text-rose-500" /> Khẩu vị phim
              </h2>
            </div>

            <div className="h-48 w-full relative flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genreData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {genreData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "16px",
                      fontWeight: "bold",
                    }}
                    itemStyle={{ color: "#fff" }}
                    formatter={(value) => [`${value}%`, "Tỉ lệ"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Text ở giữa Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-white">
                  {genreData[0].value}%
                </span>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                  {genreData[0].name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. TIẾP TỤC XEM (Sử dụng HistoryCard có sẵn) */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <PlayCircleIcon className="w-6 h-6 text-red-500" /> Tiếp tục xem
          </h2>
          {historyList.length > 4 && (
            <Link
              href="/dashboard/history"
              className="text-sm font-bold text-zinc-500 hover:text-white transition-colors"
            >
              Xem tất cả
            </Link>
          )}
        </div>

        {recentHistory.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentHistory.map((item) => (
              <HistoryCard key={item.id} item={item} type="watching" />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
            <p className="text-zinc-500 font-bold text-sm">
              Chưa có lịch sử xem phim nào.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
