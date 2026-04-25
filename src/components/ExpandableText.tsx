"use client";

import React, { useState, useRef, useEffect, memo, useMemo } from "react";
import { sanitizeHtml } from "@/lib/utils";
import { debounce } from "lodash-es";

interface Props {
  content: string;
  maxLines?: number;
}

const ExpandableText = memo(({ content, maxLines = 4 }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  const safeHTML = useMemo(() => sanitizeHtml(content), [content]);

  useEffect(() => {
    // 2. TÁCH LOGIC KIỂM TRA
    const checkTruncation = () => {
      if (textRef.current && !isExpanded) {
        const { scrollHeight, clientHeight } = textRef.current;
        setHasMore(scrollHeight > clientHeight);
      }
    };

    // 3. BỌC BẰNG LODASH DEBOUNCE (Chờ 150ms)
    const debouncedCheck = debounce(checkTruncation, 150);

    checkTruncation();

    // Lắng nghe sự kiện resize
    window.addEventListener("resize", debouncedCheck);

    return () => {
      debouncedCheck.cancel();
      window.removeEventListener("resize", debouncedCheck);
    };
  }, [safeHTML, isExpanded]);

  return (
    <div className="relative">
      <div
        ref={textRef}
        className="text-[14px] text-zinc-300 leading-relaxed break-words whitespace-pre-wrap transition-all duration-300"
        style={
          !isExpanded
            ? {
                display: "-webkit-box",
                WebkitLineClamp: maxLines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : {}
        }
        dangerouslySetInnerHTML={{ __html: safeHTML }}
      />

      {hasMore && (
        <button
          onClick={(e) => {
            e.stopPropagation();
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
