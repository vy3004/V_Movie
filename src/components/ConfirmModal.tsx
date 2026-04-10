"use client";

import React, { useEffect } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  isLoading: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmModal({
  isOpen,
  isLoading,
  title,
  description,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  variant = "danger",
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  // Lock scroll khi mở modal
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => !isLoading && onClose()}
      />

      {/* Modal Content */}
      <div className="relative bg-zinc-900 border border-zinc-800 w-full max-w-[360px] rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-[0.95] duration-200">
        <h3 className="text-white font-bold text-xl mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
          {description}
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 active:scale-95 ${
              variant === "primary"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            } disabled:opacity-50`}
          >
            {isLoading && (
              <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
