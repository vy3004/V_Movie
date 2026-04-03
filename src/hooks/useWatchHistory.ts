"use client";
import { useRef } from "react";

export function useWatchHistory(user: any, movie: any) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTimeUpdate = (currentTime: number, duration: number) => {
    if (!user || !movie) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    // Debounce 5 giây: Chỉ gửi request lên API sau khi người dùng xem ổn định 5s
    timerRef.current = setTimeout(async () => {
      await fetch("/api/history", {
        method: "POST",
        body: JSON.stringify({
          movieSlug: movie.slug,
          movieName: movie.name,
          moviePoster: movie.poster_url,
          lastTime: currentTime,
          duration: duration,
        }),
      });
    }, 5000);
  };

  return { handleTimeUpdate };
}
