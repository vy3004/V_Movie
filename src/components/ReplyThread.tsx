"use client";

import React, { useState, useEffect, memo, useCallback, useMemo } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import CommentItem from "@/components/CommentItem";
import CommentSkeleton from "@/components/CommentSkeleton";
import { useCommentContext } from "@/providers/CommentProvider";
import { useCommentsQuery } from "@/hooks/useComments";

const ThreadConnector = memo(({ className }: { className?: string }) => (
  <div
    className={`absolute border-l-[1.5px] border-b-[1.5px] border-zinc-800 rounded-bl-xl -left-[30px] ${className}`}
  />
));
ThreadConnector.displayName = "ThreadConnector";

interface ReplyThreadProps {
  parentId: string;
  movieSlug: string;
  movieName: string;
  initialCount: number;
  level?: number;
  forceOpen?: boolean;
  currentPath: string[];
}

const ReplyThread = memo(function ReplyThread({
  parentId,
  movieSlug,
  movieName,
  initialCount,
  level = 1,
  forceOpen = false,
  currentPath,
}: ReplyThreadProps) {
  const { activePath, lineageData } = useCommentContext();
  const [isOpen, setIsOpen] = useState(false);

  const isTargetInThisThread = useMemo(
    () => activePath.includes(parentId),
    [activePath, parentId],
  );

  useEffect(() => {
    if (isTargetInThisThread || forceOpen) setIsOpen(true);
  }, [isTargetInThisThread, forceOpen]);

  const {
    comments: replies,
    isLoading,
    isFetched,
    totalCount,
    hasNextPage,
    loadMore,
    isFetchingNextPage,
  } = useCommentsQuery({ movieSlug, parentId, enabled: isOpen });

  const combinedReplies = useMemo(() => {
    const list = [...replies];
    if (lineageData && lineageData.length > 0) {
      const missingItems = lineageData.filter(
        (item) =>
          item.parent_id === parentId && !list.some((r) => r.id === item.id),
      );

      if (missingItems.length > 0) {
        list.push(...missingItems);
        list.sort((a, b) => a.created_at.localeCompare(b.created_at));
      }
    }
    return list;
  }, [replies, lineageData, parentId]);

  const isGlobalActive = activePath.length > 1;

  const activeSiblingIndices = useMemo(() => {
    const indices = new Set<number>();
    let hasActiveAhead = false;

    if (isGlobalActive) {
      // Duyệt ngược từ dưới lên trên chỉ 1 lần (O(N))
      for (let i = combinedReplies.length - 1; i >= 0; i--) {
        if (hasActiveAhead) indices.add(i);
        if (activePath.includes(combinedReplies[i].id)) hasActiveAhead = true;
      }
    }
    return indices;
  }, [combinedReplies, isGlobalActive, activePath]);

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);
  const handleLoadMore = useCallback(() => loadMore(), [loadMore]);

  if (initialCount === 0 && !isOpen && !forceOpen) return null;

  const displayTotal = isOpen && isFetched ? totalCount : initialCount;
  const nextLevel = level >= 3 ? 3 : level + 1;

  return (
    <div className="mt-4">
      {!isOpen && (
        <div className="relative py-4">
          <ThreadConnector className="top-0 w-[18px] h-[26px]" />
          <button
            onClick={handleOpen}
            className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span>{displayTotal} phản hồi</span>
            <ChevronDownIcon className="size-3 stroke-[3px]" />
          </button>
        </div>
      )}

      {isOpen && (
        <div className="relative mt-2">
          <div
            className="space-y-5"
            id={isTargetInThisThread ? `thread-${parentId}` : undefined}
          >
            {/* VẼ MẢNG combinedReplies RA NGAY LẬP TỨC */}
            {combinedReplies.map((reply, index) => {
              const isCurveActive =
                isGlobalActive && activePath.includes(reply.id);
              const isAnyFollowingSiblingActive =
                activeSiblingIndices.has(index);

              return (
                <div key={reply.id} className="relative">
                  <ThreadConnector
                    className={`${index === 0 ? "top-[-36px] w-[22px] h-[58px]" : "top-[-20px] w-[22px] h-[42px]"} ${isCurveActive ? "!border-primary z-10" : "border-zinc-800"}`}
                  />
                  <CommentItem
                    comment={reply}
                    movieSlug={movieSlug}
                    movieName={movieName}
                    isReply={true}
                    rootParentId={parentId}
                    level={nextLevel}
                    currentPath={currentPath}
                    isAnyFollowingSiblingActive={isAnyFollowingSiblingActive}
                  />
                </div>
              );
            })}

            {/* HIỆN SKELETON Ở CUỐI NẾU ĐANG TẢI THÊM BÌNH LUẬN KHÁC TỪ SERVER */}
            {isLoading && (
              <CommentSkeleton number={combinedReplies.length === 0 ? 2 : 1} />
            )}
          </div>

          <div className="relative mt-4">
            <ThreadConnector className="-top-[36px] w-[22px] h-[46px]" />
            {hasNextPage ? (
              <button
                onClick={handleLoadMore}
                disabled={isFetchingNextPage}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-200 flex items-center gap-2 mb-2"
              >
                {isFetchingNextPage ? "Đang tải" : "Hiện thêm phản hồi"}
                <ChevronDownIcon className="size-3 stroke-[3px]" />
              </button>
            ) : (
              <button
                onClick={handleClose}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-200 flex items-center gap-2"
              >
                <span>Ẩn phản hồi</span>
                <ChevronUpIcon className="size-3 stroke-[3px]" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default ReplyThread;
