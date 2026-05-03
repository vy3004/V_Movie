"use client";

import { useState, useEffect } from "react";
import { WatchPartyParticipant } from "@/types";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import UserAvatar from "@/components/shared/UserAvatar";

interface HostSuccessionModalProps {
  isOpen: boolean;
  participants: WatchPartyParticipant[];
  onConfirm: (newHostUserId: string) => Promise<void>;
  onCancel: () => void;
}

export default function HostSuccessionModal({
  isOpen,
  participants,
  onConfirm,
  onCancel,
}: HostSuccessionModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset selectedUserId khi modal mở lại
  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(null);
    }
  }, [isOpen]);

  // Lọc ra những người có thể làm host (approved, không phải host hiện tại)
  const now = Date.now();
  const eligibleCandidates = participants
    .filter((p) => p.status === "approved" && p.role !== "host")
    .sort((a, b) => {
      // Ưu tiên người có quyền cao hơn
      const scoreA =
        (a.permissions?.can_manage_users ? 2 : 0) +
        (a.permissions?.can_control_media ? 1 : 0);
      const scoreB =
        (b.permissions?.can_manage_users ? 2 : 0) +
        (b.permissions?.can_control_media ? 1 : 0);

      if (scoreA !== scoreB) return scoreB - scoreA;

      // Nếu bằng nhau thì ưu tiên người vào sớm hơn
      // Participant thiếu created_at sẽ bị deprioritize (coi như mới nhất)
      return (
        new Date(a.created_at || now).getTime() -
        new Date(b.created_at || now).getTime()
      );
    });

  // Mặc định chọn người đầu tiên
  const defaultCandidate = eligibleCandidates[0];

  const handleConfirm = async () => {
    const targetUserId = selectedUserId || defaultCandidate?.user_id;
    if (!targetUserId) return;

    setIsProcessing(true);
    try {
      await onConfirm(targetUserId);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            👑 Chuyển giao quyền Host
          </h2>
          <p className="text-red-100 text-sm mt-2">
            Chọn người sẽ trở thành Chủ phòng mới
          </p>
        </div>

        {/* Body */}
        <div className="p-6">
          {eligibleCandidates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-zinc-400">
                Không có thành viên nào có thể làm host
              </p>
              <p className="text-zinc-500 text-sm mt-2">
                Bạn có thể rời phòng trực tiếp
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {eligibleCandidates.map((candidate, index) => {
                const isSelected =
                  selectedUserId === candidate.user_id ||
                  (!selectedUserId && index === 0);

                return (
                  <button
                    key={candidate.id}
                    onClick={() => setSelectedUserId(candidate.user_id)}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? "border-red-600 bg-red-600/10"
                        : "border-zinc-800 bg-zinc-800/30 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <UserAvatar
                          avatar_url={
                            candidate.profiles?.avatar_url ||
                            "/default-avatar.png"
                          }
                          user_name={candidate.profiles?.full_name || "User"}
                        />
                        {isSelected && (
                          <CheckCircleIcon className="w-5 h-5 text-red-600 absolute -top-1 -right-1 bg-zinc-900 rounded-full" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate">
                          {candidate.profiles?.full_name || "Thành viên"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {candidate.permissions?.can_manage_users && (
                            <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded">
                              Quản lý
                            </span>
                          )}
                          {candidate.permissions?.can_control_media && (
                            <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">
                              Điều khiển
                            </span>
                          )}
                          {index === 0 && !selectedUserId && (
                            <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded">
                              Đề xuất
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-zinc-950/50 border-t border-zinc-800 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing || eligibleCandidates.length === 0}
            className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? "Đang xử lý..." : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}
