"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { ChevronUpIcon } from "@heroicons/react/24/outline";

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const circleRef = useRef<SVGCircleElement>(null);

  const requestRef = useRef<number>();
  const isProtected = useRef(false); // Tấm khiên chống quán tính

  // Ref để chứa cái timeout bảo vệ, giúp ta dọn dẹp khi cần
  const protectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const circumference = 113.1;

  useEffect(() => {
    setMounted(true);
    return () => {
      // Dọn dẹp cả animation và timeout khi rời khỏi trang
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (protectionTimeoutRef.current)
        clearTimeout(protectionTimeoutRef.current);
    };
  }, []);

  // Hàm cuộn mượt giảm tốc
  const animateScroll = useCallback(() => {
    const current =
      document.documentElement.scrollTop || document.body.scrollTop;
    if (current > 0.5) {
      window.scrollTo(0, current - current / 8);
      requestRef.current = requestAnimationFrame(animateScroll);
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  const scrollToTop = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    // Nếu có một tấm khiên đang bật từ lần click trước thì dập nó đi
    if (protectionTimeoutRef.current)
      clearTimeout(protectionTimeoutRef.current);

    // Bật khiên bảo vệ trong 300ms đầu tiên
    isProtected.current = true;
    protectionTimeoutRef.current = setTimeout(() => {
      isProtected.current = false;
    }, 300);

    animateScroll();
  };

  useEffect(() => {
    if (!mounted) return;

    const handleScroll = () => {
      const y = window.scrollY;
      const h = document.documentElement.scrollHeight - window.innerHeight;

      setIsVisible(y > 300);

      if (circleRef.current && h > 0) {
        circleRef.current.style.strokeDashoffset = `${circumference - (y / h) * circumference}`;
      }
    };

    // Hàm dừng auto-scroll khi người dùng can thiệp
    const stopScroll = () => {
      // CHỈ dừng nếu KHÔNG nằm trong 300ms bảo vệ ban đầu
      if (!isProtected.current && requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Bắt sự kiện người dùng chủ động lăn chuột hoặc chạm vuốt màn hình
    window.addEventListener("wheel", stopScroll, { passive: true });
    window.addEventListener("touchstart", stopScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", stopScroll);
      window.removeEventListener("touchstart", stopScroll);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Cuộn lên đầu trang"
      className={`fixed bottom-6 right-6 z-[60] flex items-center justify-center transition-all duration-300 ${
        isVisible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-10 scale-50 pointer-events-none"
      }`}
    >
      <svg className="size-12 sm:size-14 -rotate-90 drop-shadow-lg">
        <circle
          cx="50%"
          cy="50%"
          r="18"
          fill="rgba(9, 9, 11, 0.85)"
          stroke="rgba(39, 39, 42, 1)"
          strokeWidth="2.5"
          className="backdrop-blur-md"
        />
        <circle
          ref={circleRef}
          cx="50%"
          cy="50%"
          r="18"
          fill="none"
          stroke="#ef4444"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={{ transition: "stroke-dashoffset 0.1s linear" }}
        />
      </svg>
      <ChevronUpIcon className="absolute size-5 text-white stroke-[3px]" />
    </button>
  );
}
