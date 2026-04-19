"use client";

import React, { useRef, useCallback, memo, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import ImageCustom from "@/components/ImageCustom";
import { useData } from "@/providers/BaseDataContextProvider";
import { useAuthModal } from "@/providers/AuthModalProvider";
import {
  commentSchema,
  CommentFormData,
} from "@/lib/validations/comment.validation";

interface CommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  ownerId?: string; // ID của comment cha
}

const CommentInput = memo(function CommentInput({
  onSubmit,
  placeholder = "Thêm bình luận...",
  autoFocus,
  onCancel,
  ownerId,
}: CommentInputProps) {
  const { onOpen } = useAuthModal();
  const data = useData();
  const user = data?.user;

  const containerRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    clearErrors,
    formState: { isSubmitting, errors },
  } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" },
    // CHỈ validate khi submit để tránh lỗi hiện lên lúc vừa mở form
    mode: "onSubmit",
  });

  const currentContent = watch("content") || "";
  const wordCount = currentContent.trim().split(/\s+/).filter(Boolean).length;
  const isOverLimit = wordCount > 200;

  const avatarUrl = user?.user_metadata?.avatar_url;
  const isDiceBear = avatarUrl?.includes("dicebear.com");
  const fullName = user?.user_metadata?.full_name || user?.email || "User";
  const initials = fullName.split(" ").pop()?.charAt(0).toUpperCase();

  // ==========================================
  // XỬ LÝ ĐÓNG THÔNG MINH
  // ==========================================
  const contentRef = useRef(currentContent);
  useEffect(() => {
    contentRef.current = currentContent;
  }, [currentContent]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (containerRef.current?.contains(target)) return;
      if (ownerId && target.closest(`[data-reply-id="${ownerId}"]`)) return;

      if (contentRef.current.trim() === "") {
        clearErrors();
        setIsFocused(false);
        if (onCancel) onCancel();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel, currentContent, clearErrors, ownerId]);

  // ==========================================
  // TEXTAREA AUTO RESIZE
  // ==========================================
  const {
    ref: rhfRef,
    onChange: rhfOnChange,
    ...rhfRest
  } = register("content");

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      rhfOnChange(e);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      });
    },
    [rhfOnChange],
  );

  const submitForm = async (data: CommentFormData) => {
    if (!user) return onOpen();
    try {
      await onSubmit(data.content);
      reset();
      setIsFocused(false);
      if (onCancel) onCancel();
    } catch (error) {
      console.error("Submit comment failed:", error);
      // Optionally show toast notification
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(submitForm)();
    }
  };

  const shouldShowToolbar =
    isFocused || currentContent.trim().length > 0 || isSubmitting;

  return (
    <form
      ref={containerRef}
      onSubmit={handleSubmit(submitForm)}
      className="flex gap-3 items-start w-full group transition-all"
    >
      <div className="shrink-0 size-9 rounded-full bg-zinc-800 border border-zinc-700 mt-0.5 overflow-hidden flex items-center justify-center">
        {avatarUrl ? (
          isDiceBear ? (
            /* Nếu là ảnh hoạt hình DiceBear (SVG), hiện trực tiếp không qua Proxy cho nhẹ */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={fullName}
              className="w-full h-full object-cover"
            />
          ) : (
            /* Nếu là ảnh Google hoặc ảnh User Up lên, đi qua ImageCustom để nén */
            <ImageCustom
              src={avatarUrl}
              alt="Avatar"
              widths={[80, 160]}
              className="w-full h-full object-cover"
            />
          )
        ) : (
          <span>{initials}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <textarea
          {...rhfRest}
          ref={(e) => {
            rhfRef(e);
            textareaRef.current = e;
          }}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          autoFocus={autoFocus}
          rows={1}
          placeholder={placeholder}
          disabled={isSubmitting}
          className={`w-full bg-transparent border-b transition-all resize-none overflow-hidden py-1.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-500
            ${errors.content ? "border-red-500" : isFocused ? "border-zinc-300" : "border-zinc-800"}
          `}
        />

        {shouldShowToolbar && (
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center flex-wrap gap-2">
              {currentContent.length > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${isOverLimit ? "text-primary border-red-500/20 bg-red-500/5" : "text-zinc-500 border-zinc-800"}`}
                >
                  {wordCount}/200
                </span>
              )}
              {errors.content && (
                <span className="text-primary text-[11px] font-medium animate-pulse">
                  {errors.content.message}
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  reset();
                  clearErrors();
                  if (onCancel) onCancel();
                }}
                className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition rounded-full hover:bg-zinc-800"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  currentContent.trim().length === 0 ||
                  isOverLimit
                }
                className="flex items-center gap-2 px-5 py-2 text-xs font-black bg-white text-background rounded-full hover:bg-zinc-200 transition"
              >
                <span className="hidden md:inline">
                  {isSubmitting ? "Đang gửi" : "Bình luận"}
                </span>
                <PaperAirplaneIcon className="size-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
});

export default CommentInput;
