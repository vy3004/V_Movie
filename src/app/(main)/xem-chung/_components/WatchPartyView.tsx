"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  QueueListIcon,
  Cog6ToothIcon,
  ClipboardDocumentIcon,
  PlayIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";

// Context & Hooks
import { useWatchParty } from "@/providers/WatchPartyProvider";
import { useWatchPartyStore } from "@/stores/watch-party";
import {
  selectRoom,
  selectParticipants,
  selectIsHost,
  selectCanControl,
  selectCanAccessRoomSettings,
  selectIsLoadingRoom,
  selectKickTarget,
  selectIsKicked,
  selectUser,
  selectActiveTab,
  selectMyParticipant,
} from "@/stores/watch-party/selectors";
import {
  sendChatMessage,
  handleParticipantAction,
  handleSelectEpisode,
} from "@/stores/watch-party";
import { useQuery } from "@tanstack/react-query";
import { ChatMessage, Movie } from "@/types";

// Components
import EpisodeSelectorSkeleton from "@/components/shared/EpisodeSelectorSkeleton";
// Bắt buộc ssr: false. Sử dụng .then() để trích xuất Named Export
const RoomAudioRenderer = dynamic(
  () =>
    import("@livekit/components-react").then((mod) => mod.RoomAudioRenderer),
  { ssr: false },
);

const ChatTab = dynamic(
  () => import("@/app/(main)/xem-chung/_components/ChatTab"),
  {
    ssr: false,
  },
);
const MembersTab = dynamic(
  () => import("@/app/(main)/xem-chung/_components/MembersTab"),
  { ssr: false },
);
const PlaylistTab = dynamic(
  () => import("@/app/(main)/xem-chung/_components/PlaylistTab"),
  { ssr: false },
);
const SettingsTab = dynamic(
  () => import("@/app/(main)/xem-chung/_components/SettingsTab"),
  { ssr: false },
);
const ChatOverlay = dynamic(
  () => import("@/app/(main)/xem-chung/_components/ChatOverlay"),
  { ssr: false },
);
const ConfirmModal = dynamic(() => import("@/components/ui/ConfirmModal"), {
  ssr: false,
});
const HostSuccessionModal = dynamic(
  () => import("@/app/(main)/xem-chung/_components/HostSuccessionModal"),
  { ssr: false },
);
const VideoPlayer = dynamic(() => import("@/components/shared/VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="aspect-video bg-zinc-900 animate-pulse rounded-2xl" />
  ),
});
const EpisodeSelector = dynamic(
  () => import("@/components/shared/EpisodeSelector"),
  {
    ssr: false,
    loading: () => <EpisodeSelectorSkeleton />,
  },
);

// Cấu hình nội dung linh hoạt cho 2 trường hợp
const DISCONNECT_CONFIG = {
  kicked: {
    title: "Thông báo trục xuất",
    description: "Rất tiếc, chủ phòng đã mời bạn rời khỏi phiên xem chung này.",
  },
  closed: {
    title: "Phòng đã đóng",
    description: "Phiên xem chung đã kết thúc. Hẹn gặp lại bạn lần sau nhé!",
  },
};

export default function WatchPartyView() {
  const router = useRouter();

  // Zustand selectors
  const room = useWatchPartyStore(selectRoom);
  const user = useWatchPartyStore(selectUser);
  const participants = useWatchPartyStore(selectParticipants);
  const isRealHost = useWatchPartyStore(selectIsHost);
  const canControl = useWatchPartyStore(selectCanControl);
  const canAccessRoomSettings = useWatchPartyStore(
    selectCanAccessRoomSettings,
  );
  const isLoadingRoom = useWatchPartyStore(selectIsLoadingRoom);
  const kickTarget = useWatchPartyStore(selectKickTarget);
  const isKicked = useWatchPartyStore(selectIsKicked);
  const activeTab = useWatchPartyStore(selectActiveTab);
  const myParticipant = useWatchPartyStore(selectMyParticipant);

  // Zustand actions
  const setRoom = useWatchPartyStore((state) => state.setRoom);
  const updateRoom = useWatchPartyStore((state) => state.updateRoom);
  const setKickTarget = useWatchPartyStore((state) => state.setKickTarget);
  const setActiveTab = useWatchPartyStore((state) => state.setActiveTab);

  // Context (sync functions only)
  const {
    sendControl,
    sendHeartbeat,
    applyInitialState,
    requestControllerSync,
    playerSyncRef,
    activeControllerId,
    activeControllerName,
  } = useWatchParty();

  // --- REFS & STATES PHỤC HỒI CHỨC NĂNG CŨ ---
  const [startVideoTime, setStartVideoTime] = useState<number>(0);
  const prevEpisodeRef = useRef(room?.current_episode_slug);
  const isProcessingAutoNext = useRef(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isKicking, setIsKicking] = useState(false);
  const [showSuccessionModal, setShowSuccessionModal] = useState(false);

  const disconnectReason = useMemo(() => {
    if (isLeaving) return null;
    if (isKicked) return "kicked";
    // Nếu phòng bị đánh dấu không hoạt động và mình KHÔNG phải người bấm nút đóng
    if (room && room.is_active === false && !isRealHost) return "closed";
    return null;
  }, [isLeaving, isKicked, room, isRealHost]);

  // Lấy config hiện tại
  const activeConfig = disconnectReason
    ? DISCONNECT_CONFIG[disconnectReason]
    : null;

  // --- FETCH DỮ LIỆU PHIM ---
  const { data: movie } = useQuery<Movie>({
    queryKey: ["wp-movie", room?.current_movie_slug],
    queryFn: async () => {
      const r = await fetch(
        `/api/movies/detail?slug=${room!.current_movie_slug}`,
      );
      if (!r.ok) throw new Error("Failed to fetch movie");
      const d = await r.json();
      return d.item || d;
    },
    enabled: !!room?.current_movie_slug,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const allEpisodes = useMemo(
    () => movie?.episodes?.flatMap((ep) => ep.server_data) ?? [],
    [movie?.episodes],
  );
  // --- TÍNH TOÁN TẬP PHIM ĐANG CHIẾU ---
  const activeEpisode = useMemo(() => {
    if (allEpisodes.length === 0) return null;
    return (
      allEpisodes.find((e) => e.slug === room?.current_episode_slug) ||
      allEpisodes[0]
    );
  }, [allEpisodes, room?.current_episode_slug]);

  // ĐỒNG BỘ THỜI GIAN LÚC MỚI VÀO PHÒNG
  useEffect(() => {
    const episodeChanged =
      room?.current_episode_slug !== prevEpisodeRef.current;

    if (episodeChanged) {
      setStartVideoTime(0);
      prevEpisodeRef.current = room?.current_episode_slug;
    }
  }, [room?.current_episode_slug]);

  // --- XỬ LÝ AUTO-NEXT (CHUYỂN TẬP/CHUYỂN PHIM) ---
  const handleWatchPartyAutoNext = useCallback(async () => {
    if (!isRealHost || !canControl || !room) return;

    if (isProcessingAutoNext.current) return;
    isProcessingAutoNext.current = true;

    try {
      let nextEpisode = null;

      if (movie && movie.episodes.length > 0 && activeEpisode) {
        const currentServer =
          movie.episodes.find((server) =>
            server.server_data.some((ep) => ep.slug === activeEpisode.slug),
          ) || movie.episodes[0];

        const serverEpisodes = currentServer.server_data;
        const currentIndex = serverEpisodes.findIndex(
          (e) => e.slug === activeEpisode.slug,
        );

        if (currentIndex !== -1 && currentIndex < serverEpisodes.length - 1) {
          nextEpisode = serverEpisodes[currentIndex + 1];
        }
      }

      if (nextEpisode) {
        toast.info(`Đang tự động chuyển sang: ${nextEpisode.name}...`);
        await handleSelectEpisode(nextEpisode.slug, nextEpisode.name);
        return;
      }

      const { createSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = createSupabaseClient();

      const { data: nextItems } = await supabase
        .from("watch_party_playlist")
        .select("id,movie_slug,movie_name,episode_slug,thumb_url,sort_order")
        .eq("room_id", room.id)
        .order("sort_order", { ascending: true })
        .limit(1);

      const nextItem = nextItems?.[0];

      if (nextItem) {
        toast.info(`Tự động chuyển sang phim: ${nextItem.movie_name}...`);
        await fetch(`/api/watch-party/playlist?id=${nextItem.id}`, {
          method: "DELETE",
        });
        await handleSelectEpisode(nextItem.episode_slug, nextItem.movie_name);

        if (room.current_movie_slug !== nextItem.movie_slug) {
          // 1. LƯU LẠI STATE CŨ (Để dành Rollback)
          const previousRoomState = { ...room };

          // 2. OPTIMISTIC UPDATE: Cập nhật UI ngay lập tức cho mượt
          updateRoom({
            current_movie_slug: nextItem.movie_slug,
            movie_image: nextItem.thumb_url,
          });

          // 3. GỌI DATABASE NGẦM
          const { error: updateError } = await supabase
            .from("watch_party_rooms")
            .update({
              current_movie_slug: nextItem.movie_slug,
              movie_image: nextItem.thumb_url,
            })
            .eq("id", room.id);

          // 4. KIỂM TRA LỖI VÀ ROLLBACK NẾU CẦN
          if (updateError) {
            // Nếu DB báo lỗi -> Trả lại state cũ ngay lập tức
            setRoom(previousRoomState);
            toast.error(
              "Không thể lưu thông tin phim mới. Đang khôi phục lại!",
            );
            console.error("Lỗi cập nhật phòng:", updateError);
          }
        }
      } else {
        toast.info("Đã phát hết danh sách chờ!");
      }
    } catch (error) {
      console.error("Lỗi Auto-Next:", error);
    } finally {
      setTimeout(() => {
        isProcessingAutoNext.current = false;
      }, 3000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealHost, canControl, movie, activeEpisode, room, setRoom, updateRoom]);

  const executeKick = async () => {
    if (!kickTarget) return;
    setIsKicking(true);
    try {
      await handleParticipantAction(
        kickTarget.user_id,
        "kick",
        kickTarget.profiles?.full_name || "Thành viên",
      );
      setKickTarget(null);
    } catch (error) {
      console.error("Lỗi khi trục xuất:", error);
    } finally {
      setIsKicking(false);
    }
  };

  const handleLeaveRoom = async () => {
    // Nếu là host và có thành viên khác → hiện modal chọn người kế nhiệm
    if (
      isRealHost &&
      participants.filter((p) => p.status === "approved" && p.role !== "host")
        .length > 0
    ) {
      setShowSuccessionModal(true);
      return;
    }

    // Nếu không phải host hoặc không có ai khác → rời phòng trực tiếp
    await executeLeaveRoom();
  };

  const executeLeaveRoom = async (newHostUserId?: string) => {
    if (!room) return;

    setIsLeaving(true);
    const toastId = toast.loading("Đang rời phòng...");

    try {
      const res = await fetch("/api/watch-party/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          newHostUserId, // Truyền userId của host mới nếu có
        }),
        keepalive: true,
      });

      if (!res.ok) throw new Error();

      toast.success("Hẹn gặp lại bạn nhé! 🍿", { id: toastId });
      useWatchPartyStore.getState().setWantsVoiceConnected(false);
      useWatchPartyStore.getState().setIsVoiceConnected(false);
      router.replace("/xem-chung");
    } catch {
      toast.error("Có lỗi xảy ra, nhưng bạn vẫn có thể rời đi", {
        id: toastId,
      });
      useWatchPartyStore.getState().setWantsVoiceConnected(false);
      useWatchPartyStore.getState().setIsVoiceConnected(false);
      router.replace("/xem-chung");
    }
  };

  const handleSuccessionConfirm = async (newHostUserId: string) => {
    setShowSuccessionModal(false);
    await executeLeaveRoom(newHostUserId);
  };

  const handlePlaySync = useCallback(
    (time: number) => sendControl("play", time),
    [sendControl],
  );

  const handlePauseSync = useCallback(
    (time: number) => sendControl("pause", time),
    [sendControl],
  );

  const handleSeekSync = useCallback(
    (time: number) => sendControl("seek", time),
    [sendControl],
  );

  const handleChangeEpisode = useCallback(
    (slug: string) => handleSelectEpisode(slug),
    [],
  );

  const handleSelectEpisodeFromList = useCallback(
    (episode: { slug: string; name: string }) =>
      handleSelectEpisode(episode.slug, episode.name),
    [],
  );

  const handleSendOverlayMessage = useCallback((msg: Partial<ChatMessage>) => {
    if (msg.text) sendChatMessage(msg.text);
  }, []);

  const handleProgress = useCallback(() => {}, []);

  const handleServerChange = useCallback(() => {}, []);

  // --- CẤU HÌNH TABS ---
  const pendingParticipantsCount = useMemo(
    () => participants.reduce((count, p) => count + (p.status === "pending" ? 1 : 0), 0),
    [participants],
  );

  const isOverlayChatMuted =
    !myParticipant ||
    myParticipant.status !== "approved" ||
    myParticipant.is_muted ||
    (myParticipant.role !== "host" && room?.settings?.guest_can_chat === false);

  const tabsConfig = useMemo(
    () => [
      { id: "chat", icon: ChatBubbleLeftRightIcon },
      {
        id: "members",
        icon: UserGroupIcon,
        badge: pendingParticipantsCount,
      },
      { id: "playlist", icon: QueueListIcon },
      { id: "settings", icon: Cog6ToothIcon, hide: !canAccessRoomSettings },
    ],
    [pendingParticipantsCount, canAccessRoomSettings],
  );

  if (isLoadingRoom || !room) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(220,38,38,0.3)]" />
        <p className="text-zinc-500 font-medium animate-pulse tracking-widest text-sm uppercase">
          Đang vào phòng...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 p-4 lg:p-6 pb-20 selection:bg-red-500/30 relative">
      <RoomAudioRenderer />

      {/* HEADER: Thông tin phòng & Mã phòng */}
      <div className="max-w-[1600px] mx-auto mb-6 flex items-center justify-between bg-zinc-900/40 backdrop-blur-md p-4 rounded-xl border border-zinc-800 shadow-xl gap-4">
        {" "}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="bg-red-600 p-2.5 rounded-xl shadow-lg shadow-red-600/20 shrink-0">
            <PlayIcon className="w-6 h-6 text-white fill-current" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-sm md:text-base font-black text-white uppercase truncate">
              {room.title}
            </h1>
            {activeControllerId && (
              <div className="text-[11px] text-zinc-500 mt-1">
                Đang điều khiển: {activeControllerId === user?.id ? "Bạn" : activeControllerName || "Thành viên"}
              </div>
            )}
            <button
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard
                    .writeText(room.room_code)
                    .then(() => toast.success("Đã copy mã phòng!"))
                    .catch(() => toast.error("Không thể copy mã phòng"));
                } else {
                  toast.error("Trình duyệt không hỗ trợ copy");
                }
              }}
              className="text-[11px] text-zinc-500 flex items-center gap-1 hover:text-red-500 transition-colors"
            >
              <span className="shrink-0">Mã phòng:</span>{" "}
              <span className="font-bold truncate">{room.room_code}</span>
              <ClipboardDocumentIcon className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>
        <button
          onClick={handleLeaveRoom}
          title="Rời phòng"
          className="flex items-center gap-2 text-xs font-bold bg-zinc-800 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-lg shrink-0"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          <span className="hidden sm:inline">Rời phòng</span>
        </button>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* CỘT TRÁI: VIDEO PLAYER & CHỌN TẬP */}
        <div className="xl:col-span-8 2xl:col-span-9 space-y-4">
          {activeEpisode && movie && (
            <VideoPlayer
              key={`${room.current_movie_slug}-${activeEpisode.slug}`}
              playerSyncRef={playerSyncRef}
              movieSrc={activeEpisode.link_m3u8}
              user={user}
              movie={movie}
              isWatchParty={true}
              isHost={isRealHost}
              canControl={canControl}
              initialTime={startVideoTime}
              onPlaySync={handlePlaySync}
              onPauseSync={handlePauseSync}
              onSeekSync={handleSeekSync}
              onHeartbeatSync={sendHeartbeat}
              onChangeEpisode={handleChangeEpisode}
              onAutoNext={handleWatchPartyAutoNext}
              onPlayerReady={applyInitialState}
              onManualSync={requestControllerSync}
              onProgress={handleProgress}
            >
              <ChatOverlay
                currentUserId={user?.id || ""}
                isMuted={isOverlayChatMuted}
                onSendMessage={handleSendOverlayMessage}
              />
            </VideoPlayer>
          )}

          {movie && (
            <EpisodeSelector
              servers={movie.episodes}
              episodeSelected={activeEpisode?.slug || ""}
              onSelect={handleSelectEpisodeFromList}
              activeServerIdx={0}
              onServerChange={handleServerChange}
            />
          )}
        </div>

        {/* CỘT PHẢI: HỆ THỐNG TABS */}
        <div className="sticky top-16 z-40 xl:col-span-4 2xl:col-span-3 flex flex-col bg-zinc-900/30 rounded-xl border border-zinc-800 h-[650px] xl:h-[calc(100vh-90px)] overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="flex gap-2 p-1.5 bg-zinc-950/40 border-b border-zinc-800 shrink-0">
            {tabsConfig.map(
              (tab) =>
                !tab.hide && (
                  <button
                    key={tab.id}
                    data-testid={`watch-party-tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex-1 py-3 flex justify-center rounded-xl transition-all relative ${
                      activeTab === tab.id
                        ? "bg-zinc-800 text-red-500 shadow-inner"
                        : "text-zinc-600 hover:text-zinc-400"
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    {tab.badge ? (
                      <span className="absolute top-1.5 right-2 min-w-[14px] h-4 bg-red-600 text-white text-[10px] font-black flex items-center justify-center rounded-full px-1 shadow-md">
                        {tab.badge}
                      </span>
                    ) : null}
                  </button>
                ),
            )}
          </div>

          <div className="flex-1 p-4 overflow-hidden relative">
            {activeTab === "chat" && <ChatTab />}
            {activeTab === "members" && <MembersTab />}
            {activeTab === "playlist" && <PlaylistTab />}
            {activeTab === "settings" && <SettingsTab />}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!kickTarget}
        isLoading={isKicking}
        title="Trục xuất thành viên"
        description={`Bạn có chắc chắn muốn đuổi "${kickTarget?.profiles?.full_name || "thành viên này"}" ra khỏi phòng?`}
        confirmText="Trục xuất"
        cancelText="Hủy bỏ"
        variant="danger"
        onClose={() => setKickTarget(null)}
        onConfirm={executeKick}
      />

      <HostSuccessionModal
        isOpen={showSuccessionModal}
        participants={participants}
        onConfirm={handleSuccessionConfirm}
        onCancel={() => setShowSuccessionModal(false)}
      />

      <ConfirmModal
        isOpen={disconnectReason !== null}
        isLoading={false}
        title={activeConfig?.title || ""}
        description={activeConfig?.description || ""}
        confirmText="Về trang chủ"
        cancelText="Đóng"
        variant="primary"
        onClose={() => router.replace("/xem-chung")}
        onConfirm={() => router.replace("/xem-chung")}
      />
    </div>
  );
}
