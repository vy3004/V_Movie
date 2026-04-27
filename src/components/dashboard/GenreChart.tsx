"use client";

import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ChartPieIcon } from "@heroicons/react/24/outline";
import { GenreData } from "@/types";

interface GenreChartProps {
  data: GenreData[];
}

export default function GenreChart({ data }: GenreChartProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Tổng giá trị để tính % (SQL đã trả về tổng chuẩn)
  const totalValue = useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.value, 0);
  }, [data]);

  /**
   * Logic hiển thị thông tin ở tâm vòng tròn:
   * 1. Nếu đang hover: Hiện thông tin của miếng bánh đó.
   * 2. Nếu không hover: Hiện thông tin của thằng Top 1 (data[0] vì SQL đã order by rnk).
   */
  const displayGenre = useMemo(() => {
    if (hoveredIndex !== null && data[hoveredIndex]) {
      return data[hoveredIndex];
    }
    return data[0] || { name: "Chưa có", value: 0, color: "#3f3f46" };
  }, [hoveredIndex, data]);

  const displayPercentage = useMemo(() => {
    if (totalValue === 0) return 0;
    return Math.round((displayGenre.value / totalValue) * 100);
  }, [displayGenre.value, totalValue]);

  return (
    <div className="bg-zinc-900/30 backdrop-blur-xl p-6 rounded-[2.5rem] flex-1 flex flex-col hover:bg-zinc-900/40 transition-colors">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ChartPieIcon className="w-5 h-5 text-rose-500" /> Khẩu vị điện ảnh
        </h2>
      </div>

      <div
        className="relative w-full h-[220px] lg:h-[200px] mt-2 select-none"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {isMounted && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="65%"
                outerRadius="85%"
                paddingAngle={data.length > 1 ? 4 : 0}
                dataKey="value"
                stroke="none"
                isAnimationActive={false}
                onMouseEnter={(_, index) => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`genre-cell-${entry.name}-${index}`}
                    fill={entry.color} // Màu này lấy trực tiếp từ SQL (Đỏ, Xanh, Xám...)
                    style={{
                      outline: "none",
                      filter:
                        hoveredIndex === index ? "brightness(1.2)" : "none",
                      transition: "filter 0.3s ease",
                    }}
                    className="cursor-pointer outline-none"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}

        {/* CENTER INFO */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
          <span
            className="text-4xl font-black text-white transition-colors duration-300 leading-none"
            style={{ color: displayGenre.color }}
          >
            {displayPercentage}%
          </span>
          <span className="text-[10px] lg:text-[11px] text-zinc-400 font-bold uppercase tracking-widest transition-colors duration-300 mt-1 truncate w-full px-2">
            {displayGenre.name}
          </span>
        </div>
      </div>
    </div>
  );
}
