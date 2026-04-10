"use client";

import React, { useState, useRef, useEffect, memo } from "react";

interface Props {
  content: string;
  maxLines?: number;
}

const ExpandableText = memo(({ content, maxLines = 4 }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // Kiểm tra xem nội dung có bị cắt (truncate) hay không
  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        const { scrollHeight, clientHeight } = textRef.current;
        // Nếu chiều cao thực tế lớn hơn chiều cao hiển thị -> Cần nút "Xem thêm"
        setHasMore(scrollHeight > clientHeight);
      }
    };

    // Kiểm tra ngay khi mount và khi content thay đổi
    checkTruncation();

    // Lắng nghe sự kiện resize màn hình vì chiều rộng đổi sẽ làm số dòng đổi
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [content]);

  return (
    <div className="relative">
      <p
        ref={textRef}
        className={`text-[14px] text-zinc-300 leading-relaxed break-words whitespace-pre-wrap transition-all duration-300 ${
          !isExpanded ? "line-clamp-4" : ""
        }`}
        style={!isExpanded ? { WebkitLineClamp: maxLines } : {}}
      >
        {content}
      </p>

      {hasMore && (
        <button
          onClick={(e) => {
            e.stopPropagation(); // Ngăn chặn trigger click vào cha (activePath)
            setIsExpanded(!isExpanded);
          }}
          className="text-[13px] text-zinc-500 hover:text-white mt-1 transition-colors outline-none"
        >
          {isExpanded ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
    </div>
  );
});

ExpandableText.displayName = "ExpandableText";

export default ExpandableText;
