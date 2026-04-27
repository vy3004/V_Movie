export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  nextThreshold?: string;
}

export const calculateUserBadges = (stats: {
  totalHours: number;
  streakDays: number;
  genreData: { name: string; value: number }[];
}): Badge[] => {
  const badges: Badge[] = [];
  const { totalHours = 0, streakDays = 0, genreData = [] } = stats || {};

  // --- 1. NHÓM CẤP ĐỘ (THỜI GIAN XEM) ---
  if (totalHours >= 500)
    badges.push({
      id: "lv5",
      title: "Kẻ Thống Trị",
      description: "Vị thần của mọi khung hình",
      icon: "👑",
      color: "text-purple-400",
      bg: "bg-purple-400/10",
      border: "border-purple-400/20",
    });
  else if (totalHours >= 200)
    badges.push({
      id: "lv4",
      title: "Đạo Diễn",
      description: "Tầm nhìn điện ảnh xuất sắc",
      icon: "🎬",
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      nextThreshold: "Cần 500h để thành Kẻ Thống Trị",
    });
  else if (totalHours >= 50)
    badges.push({
      id: "lv3",
      title: "Cú Đêm",
      description: "Bất trị trước bóng đêm",
      icon: "🦉",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      nextThreshold: "Cần 200h để thành Đạo Diễn",
    });
  else if (totalHours >= 10)
    badges.push({
      id: "lv2",
      title: "Mọt Phim",
      description: "Sống trong từng thước phim",
      icon: "🍿",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/20",
      nextThreshold: "Cần 50h để thành Cú Đêm",
    });
  else
    badges.push({
      id: "lv1",
      title: "Tân Binh",
      description: "Hành trình bắt đầu từ đây",
      icon: "🌱",
      color: "text-zinc-400",
      bg: "bg-zinc-400/10",
      border: "border-zinc-400/20",
      nextThreshold: "Cần 10h để thành Mọt Phim",
    });

  // --- 2. NHÓM CHUỖI (STREAK) ---
  if (streakDays >= 30)
    badges.push({
      id: "st3",
      title: "Kỷ Luật Thép",
      description: "Kiên trì suốt 30 ngày",
      icon: "💎",
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      border: "border-cyan-400/20",
    });
  else if (streakDays >= 7)
    badges.push({
      id: "st2",
      title: "Tuần Vàng",
      description: "7 ngày không bỏ lỡ",
      icon: "🌟",
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
      border: "border-yellow-400/20",
      nextThreshold: "Cần 30 ngày để đạt Kỷ Luật Thép",
    });
  else if (streakDays >= 3)
    badges.push({
      id: "st1",
      title: "Giữ Lửa",
      description: "Đam mê rực cháy",
      icon: "🔥",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      nextThreshold: "Cần 7 ngày để đạt Tuần Vàng",
    });

  // --- 3. NHÓM THỂ LOẠI (GENRES) ---
  const genreConfig: Record<
    string,
    { t: string; i: string; c: string; bg: string; bd: string }
  > = {
    "Âm Nhạc": {
      t: "Nghệ Sĩ",
      i: "🎵",
      c: "text-blue-400",
      bg: "bg-blue-400/10",
      bd: "border-blue-400/20",
    },
    "Bí ẩn": {
      t: "Thám Tử",
      i: "🔍",
      c: "text-slate-400",
      bg: "bg-slate-400/10",
      bd: "border-slate-400/20",
    },
    "Chiến Tranh": {
      t: "Chiến Binh",
      i: "🛡️",
      c: "text-stone-500",
      bg: "bg-stone-500/10",
      bd: "border-stone-500/20",
    },
    "Chính kịch": {
      t: "Thấu Cảm",
      i: "🎭",
      c: "text-indigo-400",
      bg: "bg-indigo-400/10",
      bd: "border-indigo-400/20",
    },
    "Cổ Trang": {
      t: "Hoài Cổ",
      i: "🏮",
      c: "text-amber-600",
      bg: "bg-amber-600/10",
      bd: "border-amber-600/20",
    },
    "Gia Đình": {
      t: "Gắn Kết",
      i: "🏠",
      c: "text-lime-500",
      bg: "bg-lime-500/10",
      bd: "border-lime-500/20",
    },
    "Hài Hước": {
      t: "Vui Vẻ",
      i: "🤡",
      c: "text-yellow-300",
      bg: "bg-yellow-300/10",
      bd: "border-yellow-300/20",
    },
    "Hành Động": {
      t: "Mạnh Mẽ",
      i: "⚔️",
      c: "text-red-500",
      bg: "bg-red-500/10",
      bd: "border-red-500/20",
    },
    "Hình Sự": {
      t: "Công Lý",
      i: "🚔",
      c: "text-blue-600",
      bg: "bg-blue-600/10",
      bd: "border-blue-600/20",
    },
    "Học Đường": {
      t: "Thanh Xuân",
      i: "🏫",
      c: "text-sky-400",
      bg: "bg-sky-400/10",
      bd: "border-sky-400/20",
    },
    "Khoa Học": {
      t: "Học Giả",
      i: "🧪",
      c: "text-teal-400",
      bg: "bg-teal-400/10",
      bd: "border-teal-400/20",
    },
    "Kinh Dị": {
      t: "Gan Dạ",
      i: "👻",
      c: "text-zinc-400",
      bg: "bg-zinc-400/10",
      bd: "border-zinc-400/20",
    },
    "Kinh Điển": {
      t: "Kinh Điển",
      i: "🎞️",
      c: "text-orange-400",
      bg: "bg-orange-400/10",
      bd: "border-orange-400/20",
    },
    "Phiêu Lưu": {
      t: "Thám Hiểm",
      i: "🧭",
      c: "text-emerald-500",
      bg: "bg-emerald-500/10",
      bd: "border-emerald-500/20",
    },
    "Short Drama": {
      t: "Tốc Độ",
      i: "📱",
      c: "text-fuchsia-400",
      bg: "bg-fuchsia-400/10",
      bd: "border-fuchsia-400/20",
    },
    "Tài Liệu": {
      t: "Tri Thức",
      i: "📚",
      c: "text-stone-400",
      bg: "bg-stone-400/10",
      bd: "border-stone-400/20",
    },
    "Tâm Lý": {
      t: "Nội Tâm",
      i: "🧠",
      c: "text-violet-400",
      bg: "bg-violet-400/10",
      bd: "border-violet-400/20",
    },
    "Thần Thoại": {
      t: "Huyền Thoại",
      i: "🧜‍♂️",
      c: "text-cyan-300",
      bg: "bg-cyan-300/10",
      bd: "border-cyan-300/20",
    },
    "Thể Thao": {
      t: "Năng Động",
      i: "⚽",
      c: "text-green-500",
      bg: "bg-green-500/10",
      bd: "border-green-500/20",
    },
    "Tình Cảm": {
      t: "Lãng Mạn",
      i: "❤️",
      c: "text-pink-400",
      bg: "bg-pink-400/10",
      bd: "border-pink-400/20",
    },
    "Viễn Tưởng": {
      t: "Du Hành",
      i: "🚀",
      c: "text-purple-400",
      bg: "bg-purple-400/10",
      bd: "border-purple-400/20",
    },
    "Võ Thuật": {
      t: "Hiệp Khách",
      i: "🥋",
      c: "text-orange-600",
      bg: "bg-orange-600/10",
      bd: "border-orange-600/20",
    },
  };

  genreData.forEach((g) => {
    const cfg = genreConfig[g.name];
    if (cfg && g.value >= 3) {
      badges.push({
        id: `g_${g.name}`,
        title: cfg.t,
        description: `Fan cứng thể loại ${g.name}`,
        icon: cfg.i,
        color: cfg.c,
        bg: cfg.bg,
        border: cfg.bd,
      });
    }
  });

  return badges;
};
