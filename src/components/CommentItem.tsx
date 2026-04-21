"use client";

import React, {
  useState,
  useEffect,
  memo,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { formatTimeAgo } from "@/lib/utils";
import { CommentItem as CommentType } from "@/types";
import {
  HandThumbUpIcon as HandThumbUpSolid,
  TrashIcon,
} from "@heroicons/react/24/solid";
import {
  HandThumbUpIcon as HandThumbUpOutline,
  ChatBubbleOvalLeftEllipsisIcon,
} from "@heroicons/react/24/outline";
import CommentInput from "@/components/CommentInput";
import ReplyThread from "@/components/ReplyThread";
import ExpandableText from "@/components/ExpandableText";
import UserAvatar from "@/components/UserAvatar";
import { useData } from "@/providers/BaseDataContextProvider";
import { useCommentMutations } from "@/hooks/useComments";
import { useConfirm } from "@/providers/ConfirmProvider";
import { useCommentContext } from "@/providers/CommentProvider";

interface Props {
  comment: CommentType;
  movieSlug: string;
  movieName: string;
  isReply?: boolean;
  rootParentId?: string;
  level?: number;
  currentPath: string[];
  isAnyFollowingSiblingActive?: boolean;
}

const CommentItem = memo(
  function CommentItem({
    comment,
    movieSlug,
    movieName,
    isReply,
    rootParentId,
    level = 1,
    currentPath = [],
    isAnyFollowingSiblingActive = false,
  }: Props) {
    const data = useData();
    const user = data?.user;
    const { confirm } = useConfirm();
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [forceOpenReplies, setForceOpenReplies] = useState(false);
    const [isTargetFlash, setIsTargetFlash] = useState(false);

    const itemRef = useRef<HTMLDivElement>(null);

    const isPending = comment.id.startsWith("temp-");
    const threadId = level >= 3 && rootParentId ? rootParentId : comment.id;
    const hasReplies = comment.replies_count > 0;

    const { activePath, setActivePath, targetId } = useCommentContext();

    // TỰ ĐỘNG CUỘN ĐƯỢC TỐI ƯU
    useEffect(() => {
      if (targetId && comment.id === targetId && itemRef.current) {
        let flashOffTimer: ReturnType<typeof setTimeout> | undefined;
        let isCancelled = false;

        const scrollTimer = setTimeout(() => {
          if (isCancelled) return;

          itemRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          setIsTargetFlash(true);

          // Lưu lại timer 2.5s
          flashOffTimer = setTimeout(() => setIsTargetFlash(false), 2500);
        }, 100);

        return () => {
          isCancelled = true;
          clearTimeout(scrollTimer);
          if (flashOffTimer) clearTimeout(flashOffTimer);
        };
      }
    }, [targetId, comment.id]);

    const myPath = useMemo(
      () => [...currentPath, comment.id],
      [currentPath, comment.id],
    );
    const isGlobalActive = activePath.length > 1;
    const isActive = isGlobalActive && activePath.includes(comment.id);
    const isSpineActive =
      isActive && activePath[activePath.length - 1] !== comment.id;

    const { toggleLike, deleteComment, addComment } = useCommentMutations({
      movieSlug,
      parentId: threadId,
      user,
    });

    const handleDelete = useCallback(() => {
      confirm({
        title: "Xóa bình luận?",
        description: "Bạn có chắc chắn muốn xóa không?",
        onConfirm: async () => await deleteComment(comment.id),
      });
    }, [confirm, deleteComment, comment.id]);

    const toggleInput = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowReplyInput((prev) => !prev);
        setActivePath(myPath);
      },
      [myPath, setActivePath],
    );

    const handleReplySubmit = useCallback(
      async (content: string) => {
        const finalContent =
          isReply && comment.profiles?.full_name
            ? `@${comment.profiles.full_name} ${content}`
            : content;

        // Truyền chuẩn rootParentId và comment.id để backend biết lưu/thông báo cho ai
        await addComment(
          finalContent,
          movieName,
          comment.id,
          rootParentId || null,
        );

        setShowReplyInput(false);
        if (threadId === comment.id) setForceOpenReplies(true);
      },
      [
        isReply,
        comment.profiles,
        addComment,
        movieName,
        threadId,
        comment.id,
        rootParentId,
      ],
    );

    return (
      <div
        ref={itemRef}
        id={`comment-${comment.id}`}
        className={`relative flex gap-3 group rounded-xl transition-colors ${isTargetFlash ? "animate-target-flash" : ""}`}
      >
        {hasReplies && level < 3 && (
          <div
            className={`absolute left-[18px] top-[48px] bottom-[48px] w-[1.5px] ${isSpineActive ? "!bg-primary" : "bg-zinc-800"}`}
          />
        )}

        {level > 1 && (
          <div
            className={`absolute -left-[30px] -top-[36px] bottom-0 w-[1.5px] ${isAnyFollowingSiblingActive ? "!bg-primary z-10" : "bg-zinc-800"}`}
          />
        )}

        <UserAvatar
          className={`shrink-0 rounded-full border-2 transition-colors duration-500 mt-0.5 z-10 ${isActive ? "border-red-500" : "border-zinc-800"}`}
          avatar_url={comment.profiles?.avatar_url}
          user_name={comment.profiles?.full_name}
          size={36}
        />

        <div className="flex-1 min-w-0">
          <div
            className="flex items-center gap-2 mb-0.5 cursor-pointer"
            onClick={() => setActivePath(myPath)}
          >
            <span className="font-semibold text-zinc-100 text-[13px]">
              {comment.profiles?.full_name || "Người dùng"}
            </span>
            <span className="text-[11px] text-zinc-500">
              {formatTimeAgo(comment.created_at)}
            </span>
          </div>

          <ExpandableText content={comment.content} maxLines={4} />

          <div className="flex items-center gap-4 mt-2 text-xs font-bold text-zinc-500">
            {!isPending ? (
              <>
                <button
                  onClick={() => toggleLike(comment.id)}
                  className={`flex items-center gap-1.5 transition-colors ${comment.is_liked_by_me ? "text-red-500" : "hover:text-zinc-200"}`}
                >
                  {comment.is_liked_by_me ? (
                    <HandThumbUpSolid className="w-4 h-4" />
                  ) : (
                    <HandThumbUpOutline className="w-4 h-4" />
                  )}
                  <span>{comment.likes_count}</span>
                </button>
                <button
                  onMouseDown={toggleInput}
                  data-reply-id={comment.id}
                  className="flex items-center gap-1.5 hover:text-zinc-200 transition-colors"
                >
                  <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4" />
                  <span>Phản hồi</span>
                </button>
                {user?.id === comment.user_id && (
                  <button
                    onClick={handleDelete}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            ) : (
              <span className="animate-pulse font-normal">Đang gửi...</span>
            )}
          </div>

          {showReplyInput && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <CommentInput
                ownerId={comment.id}
                onSubmit={handleReplySubmit}
                onCancel={() => setShowReplyInput(false)}
                placeholder={`Trả lời ${comment.profiles?.full_name}...`}
                autoFocus
              />
            </div>
          )}

          {!isPending &&
            (comment.replies_count > 0 || forceOpenReplies) &&
            level < 3 && (
              <div className="mt-2">
                <ReplyThread
                  parentId={comment.id}
                  movieSlug={movieSlug}
                  movieName={movieName}
                  initialCount={comment.replies_count}
                  level={level}
                  forceOpen={forceOpenReplies}
                  currentPath={myPath}
                />
              </div>
            )}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.comment.id === next.comment.id &&
    prev.comment.likes_count === next.comment.likes_count &&
    prev.comment.is_liked_by_me === next.comment.is_liked_by_me &&
    prev.comment.replies_count === next.comment.replies_count &&
    prev.comment.content === next.comment.content &&
    prev.comment.profiles?.avatar_url === next.comment.profiles?.avatar_url &&
    prev.isAnyFollowingSiblingActive === next.isAnyFollowingSiblingActive,
);

export default CommentItem;
