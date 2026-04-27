"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import { ActivityData } from "@/types";

interface ActivityChartProps {
  data: ActivityData[];
}

export default function ActivityChart({ data }: ActivityChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Tính tổng giờ và giờ cao nhất 1 lần duy nhất thay vì tính trong mỗi vòng lặp
  const totalHours = data.reduce((sum, d) => sum + (d.hours || 0), 0);
  const maxHours =
    data.length > 0 ? Math.max(...data.map((d) => d.hours || 0)) : 0;
  return (
    <div className="lg:col-span-2 bg-zinc-900/30 backdrop-blur-xl p-8 rounded-[2.5rem] flex flex-col hover:bg-zinc-900/40 transition-colors">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ChartBarIcon className="w-6 h-6 text-emerald-500" /> Nhịp độ cày
            phim
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            7 ngày qua bạn đã xem tổng cộng {totalHours} giờ.
          </p>
        </div>
      </div>

      <div
        className="h-[220px] lg:h-64 w-full mt-auto select-none [&_*:focus]:outline-none [&_*:focus-visible]:outline-none [&_path:focus]:outline-none"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {isMounted && (
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 550, height: 250 }}
          >
            <BarChart
              data={data}
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
                cursor={{ fill: "#27272a", opacity: 0.3, rx: 8 }}
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "16px",
                  fontWeight: "bold",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                }}
                itemStyle={{ color: "#ef4444" }}
                formatter={(value) => [`${value} Giờ`, "Đã xem"]}
              />
              <Bar dataKey="hours" radius={[8, 8, 8, 8]} activeBar={false}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.hours === maxHours && entry.hours > 0
                        ? "#ef4444"
                        : "#3f3f46"
                    }
                    className="transition-all duration-300 hover:opacity-80 cursor-pointer outline-none"
                    style={{ outline: "none" }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
