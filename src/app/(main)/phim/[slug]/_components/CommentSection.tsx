"use client";

import { memo, Suspense, useCallback, useEffect, useRef } from "react";
import {
  ArrowPathIcon,
  ChatBubbleOvalLeftEllipsisIcon,
} from "@heroicons/react/24/outline";
import CommentInput from "./CommentInput";
import CommentSkeleton from "./CommentSkeleton";
import CommentItem from "./CommentItem";

import { useData } from "@/providers/BaseDataContextProvider";
import {
  CommentProvider,
  useCommentContext,
} from "@/providers/CommentProvider";
import { useCommentsQuery } from "../_hooks/useCommentsQuery";
import { useCommentMutations } from "../_hooks/useCommentMutations";

interface CommentSectionProps {
  movieSlug: string;
  movieName: string;
}

export default function CommentSection({
  movieSlug,
  movieName,
}: CommentSectionProps) {
  return (
    <Suspense
      fallback={
        <div className="h-40 animate-pulse bg-zinc-900 rounded-xl"></div>
      }
    >
      <CommentProvider movieSlug={movieSlug}>
        <CommentListContent movieSlug={movieSlug} movieName={movieName} />
      </CommentProvider>
    </Suspense>
  );
}

const CommentListContent = memo(function CommentListContent({
  movieSlug,
  movieName,
}: CommentSectionProps) {
  const { user } = useData();

  const { setActivePath, targetId, setLineageData } = useCommentContext();

  const {
    comments,
    pathIds,
    lineageData,
    targetComment,
    isTargetLoading,
    isListFetched,
    totalCount,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    loadMore,
    refresh,
  } = useCommentsQuery({ movieSlug });

  const lastSyncedPathRef = useRef<string>("");

  // HIỆU ỨNG 1: CUỘN MÀN HÌNH XUỐNG VÙNG CHỨA BÌNH LUẬN
  // Xử lý khi user đang ở trên đỉnh web (đang xem video)
  useEffect(() => {
    if (targetId) {
      const el = document.getElementById("comment-section-root");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [targetId]);

  useEffect(() => {
    const currentPathString = JSON.stringify(pathIds);
    if (pathIds.length > 0 && currentPathString !== lastSyncedPathRef.current) {
      lastSyncedPathRef.current = currentPathString;
      setActivePath(pathIds);
      setLineageData(lineageData);
    }
  }, [pathIds, lineageData, setActivePath, setLineageData]);

  const { addComment } = useCommentMutations({ movieSlug, user });

  const handleAddComment = useCallback(
    async (content: string) => {
      await addComment(content, movieName);
    },
    [addComment, movieName],
  );

  const handleRefresh = useCallback(() => refresh(), [refresh]);
  const handleLoadMore = useCallback(() => loadMore(), [loadMore]);

  return (
    <div
      id="comment-section-root"
      className="bg-background p-4 sm:p-6 rounded-xl border border-zinc-800/50 space-y-6 scroll-mt-24"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-5 bg-red-600 rounded-full shadow-[0_0_12px_rgba(220,38,38,0.5)]"></span>
          Bình Luận ({totalCount})
        </h3>
        <div className="flex items-center gap-4">
          <button
            onClick={handleRefresh}
            disabled={isFetching || isLoading}
            aria-label="Làm mới bình luận"
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-white transition-all group disabled:opacity-50"
          >
            <ArrowPathIcon
              aria-hidden="true"
              className={`w-4 h-4 ${isFetching ? "animate-spin text-red-500" : "group-hover:rotate-180 transition-transform duration-500"}`}
            />
            <span className="hidden sm:inline">
              {isFetching ? "Đang cập nhật..." : "Làm mới"}
            </span>
          </button>
        </div>
      </div>

      <div className="pt-2">
        <CommentInput
          onSubmit={handleAddComment}
          placeholder="Thêm bình luận công khai..."
        />
      </div>

      <div className="mt-8 space-y-2">
        {(isLoading || isTargetLoading) && !isFetchingNextPage ? (
          <CommentSkeleton number={3} />
        ) : (
          <>
            {/* 1. HỘI THOẠI TIÊU ĐIỂM */}
            {targetComment && lineageData && lineageData.length > 0 && (
              <div className="mb-10 p-4 sm:p-6 rounded-2xl border border-red-500/20 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="flex items-center gap-2 text-xs tracking-[0.1em] mb-6">
                  <ChatBubbleOvalLeftEllipsisIcon className="size-6" />
                  <span>Bạn được nhắc đến trong bình luận này</span>
                </div>
                <CommentItem
                  comment={targetComment}
                  movieSlug={movieSlug}
                  movieName={movieName}
                  level={1}
                  currentPath={[]}
                />
              </div>
            )}

            {/* 2. DANH SÁCH BÌNH LUẬN MẶC ĐỊNH */}
            {isListFetched &&
            comments.length === 0 &&
            (!lineageData || lineageData.length === 0) ? (
              <div className="py-16 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/10">
                <p className="text-sm italic">Chưa có bình luận nào.</p>
                <p className="text-[11px] mt-1 opacity-60">
                  Hãy là người đầu tiên nêu cảm nghĩ!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/40">
                {comments.map((comment) => (
                  <div key={comment.id} className="py-6 first:pt-0 last:pb-0">
                    <CommentItem
                      comment={comment}
                      movieSlug={movieSlug}
                      movieName={movieName}
                      currentPath={[]}
                    />
                  </div>
                ))}
              </div>
            )}

            {hasNextPage && (
              <div className="pt-10 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isFetchingNextPage}
                  className="px-10 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-full transition-all bg-zinc-900/50 hover:bg-zinc-800 disabled:opacity-50 shadow-sm flex items-center gap-3"
                >
                  {isFetchingNextPage ? (
                    <>
                      <div className="size-3 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                      <span>Đang nạp dữ liệu...</span>
                    </>
                  ) : (
                    "Xem thêm bình luận"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});
