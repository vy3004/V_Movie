import React, { useMemo } from "react";
import { WSRV_PROXY, MOVIE_IMG_PATH } from "@/lib/configs";

interface UserAvatarProps {
  avatar_url?: string | null;
  user_name?: string;
  size?: number;
  status?: "online" | "away" | "offline";
  className?: string;
}

const GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-emerald-400 to-cyan-500",
  "from-pink-500 to-rose-500",
  "from-amber-400 to-orange-500",
  "from-violet-500 to-purple-600",
];

const UserAvatar: React.FC<UserAvatarProps> = ({
  avatar_url,
  user_name = "U",
  size = 40,
  status,
  className = "",
}) => {
  const fetchSize = Math.round(size * 1.5);

  // 1. Xử lý logic ảnh
  const src = useMemo(() => {
    if (!avatar_url) return null;
    if (avatar_url.includes("dicebear.com")) return avatar_url;

    let rawUrl = avatar_url.startsWith("http")
      ? avatar_url
      : `${MOVIE_IMG_PATH}${avatar_url}`;
    if (rawUrl.includes("googleusercontent.com")) {
      rawUrl = rawUrl.replace(/=s\d+[^&]*/, `=s${fetchSize}-c`);
    }

    return `${WSRV_PROXY}/?output=webp&q=75&url=${encodeURIComponent(rawUrl)}&w=${fetchSize}&h=${fetchSize}&fit=cover`;
  }, [avatar_url, fetchSize]);

  // 2. Xử lý fallback khi không có ảnh
  const fallback = useMemo(() => {
    if (src) return null;
    const initial = user_name.trim().charAt(0).toUpperCase() || "?";
    let hash = 0;
    for (let i = 0; i < user_name.length; i++) {
      hash = user_name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return { initial, gradient: GRADIENTS[Math.abs(hash) % GRADIENTS.length] };
  }, [user_name, src]);

  // 3. Xử lý Status (To, có viền, và tiêu đề khi hover)
  const statusConfig = useMemo(() => {
    if (!status) return null; // Nếu không truyền status thì không hiện chấm tròn

    const config = {
      online: { color: "bg-emerald-500", label: "Online" },
      away: { color: "bg-yellow-500", label: "Away" },
      offline: { color: "bg-zinc-500", label: "Offline" },
    };

    const current = config[status] || config.offline;
    const dotSize = Math.max(Math.floor(size * 0.32), 12);
    const borderWidth = size > 50 ? "border-[4px]" : "border-[3px]";

    return { ...current, dotSize, borderWidth };
  }, [status, size]);

  return (
    <div
      className={`relative shrink-0 inline-flex select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Vòng tròn Avatar chính */}
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-zinc-800 shadow-inner">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={user_name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center text-white font-bold bg-gradient-to-br ${fallback?.gradient}`}
          >
            <span style={{ fontSize: size * 0.4 }}>{fallback?.initial}</span>
          </div>
        )}
      </div>

      {/* Chấm tròn trạng thái - Chỉ render nếu có statusConfig */}
      {statusConfig && (
        <div
          title={statusConfig.label} // Hiển thị chữ khi di chuột vào
          className={`absolute -bottom-0.5 -right-0.5 rounded-full ${statusConfig.borderWidth} border-[#18181b] ${statusConfig.color} shadow-lg cursor-help transition-colors duration-300`}
          style={{
            width: statusConfig.dotSize,
            height: statusConfig.dotSize,
          }}
        />
      )}
    </div>
  );
};

export default React.memo(UserAvatar);
