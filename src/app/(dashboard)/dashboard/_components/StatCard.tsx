import React from "react";

export type StatColor = "red" | "rose" | "amber" | "emerald" | "blue";

export interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: StatColor;
  className?: string;
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  color,
  className = "",
}: StatCardProps) {
  // 2. Gộp màu và đồng bộ thiết kế viền (border) cho đồng đều
  const colors: Record<StatColor, string> = {
    red: "bg-red-600/10 text-red-500 border-red-500/10",
    rose: "bg-rose-600/10 text-rose-500 border-rose-500/10",
    amber: "bg-amber-600/10 text-amber-500 border-amber-500/10",
    emerald: "bg-emerald-600/10 text-emerald-500 border-emerald-500/10",
    blue: "bg-blue-600/10 text-blue-500 border-blue-500/10",
  };

  return (
    <div
      className={`bg-zinc-900/30 border border-zinc-800 p-4 rounded-3xl flex items-center gap-4 ${className}`}
    >
      {/* Class 'border' được chèn cứng vào đây để dùng chung */}
      <div className={`p-3 rounded-2xl border ${colors[color]}`}>
        <Icon className="size-6" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          {label}
        </p>
        <p className="text-xl font-black text-white leading-none mt-1">
          {value}
        </p>
      </div>
    </div>
  );
}
