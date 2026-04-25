"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
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
} from "@heroicons/react/24/outline";

// Components
import EpisodeSelector from "@/components/EpisodeSelector";
import PlaylistTab from "@/components/watch-party/PlaylistTab";
import SettingsTab from "@/components/watch-party/SettingsTab";
import MembersTab from "@/components/watch-party/MembersTab";
import ChatTab from "@/components/watch-party/ChatTab";
import ChatOverlay from "@/components/watch-party/ChatOverlay";
import ConfirmModal from "@/components/ConfirmModal";
import { RoomAudioRenderer } from "@livekit/components-react";

// Context & Hooks
import { useWatchParty } from "@/providers/WatchPartyProvider";
import { useQuery } from "@tanstack/react-query";
import { Movie } from "@/types";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="aspect-video bg-zinc-900 animate-pulse rounded-2xl" />
  ),
});

type TabType = "chat" | "members" | "playlist" | "settings";

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
  const [activeTab, setActiveTab] = useState<TabType>("chat");

  const {
    room,
    setRoom,
    user,
    messages,
    participants,
    isRealHost,
    canControl,
    hasModeratorAuth,
    sendControl,
    playerSyncRef,
    isLoadingRoom,
    handleSendMessage,
    handleSelectEpisode,
    handleParticipantAction,
    initialState,
    kickTarget,
    setKickTarget,
    isKicked,
  } = useWatchParty();

  // --- REFS & STATES PHỤC HỒI CHỨC NĂNG CŨ ---
  const [startVideoTime, setStartVideoTime] = useState<number>(0);
  const prevEpisodeRef = useRef(room?.current_episode_slug);
  const isProcessingAutoNext = useRef(false);
  const [isKicking, setIsKicking] = useState(false);

  const disconnectReason = useMemo(() => {
    if (isKicked) return "kicked";
    // Nếu phòng bị đánh dấu không hoạt động và mình KHÔNG phải người bấm nút đóng
    if (room && room.is_active === false && !isRealHost) return "closed";
    return null;
  }, [isKicked, room, isRealHost]);

  // Lấy config hiện tại
  const activeConfig = disconnectReason
    ? DISCONNECT_CONFIG[disconnectReason]
    : null;

  // --- FETCH DỮ LIỆU PHIM ---
  const { data: movie } = useQuery<Movie>({
    queryKey: ["wp-movie", room?.current_movie_slug],
    queryFn: () =>
      fetch(`/api/movies/detail?slug=${room!.current_movie_slug}`).then((r) =>
        r.json().then((d) => d.item || d),
      ),
    enabled: !!room?.current_movie_slug,
  });

  // --- TÍNH TOÁN TẬP PHIM ĐANG CHIẾU ---
  const activeEpisode = useMemo(() => {
    if (!movie?.episodes) return null;
    const allEpisodes = movie.episodes.flatMap((ep) => ep.server_data);
    return (
      allEpisodes.find((e) => e.slug === room.current_episode_slug) ||
      allEpisodes[0]
    );
  }, [movie, room?.current_episode_slug]);

  // ĐỒNG BỘ THỜI GIAN LÚC MỚI VÀO PHÒNG
  useEffect(() => {
    const episodeChanged =
      room?.current_episode_slug !== prevEpisodeRef.current;

    if (episodeChanged) {
      setStartVideoTime(0);
      prevEpisodeRef.current = room?.current_episode_slug;
    } else if (initialState?.time !== undefined) {
      setStartVideoTime(initialState.time);
    }
  }, [initialState, room?.current_episode_slug]);

  // --- XỬ LÝ AUTO-NEXT (CHUYỂN TẬP/CHUYỂN PHIM) ---
  const handleWatchPartyAutoNext = async () => {
    if (!isRealHost || !canControl) return;

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
        .select("*")
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
          setRoom((prev) => ({
            ...prev,
            current_movie_slug: nextItem.movie_slug,
            movie_image: nextItem.thumb_url,
          }));
          await supabase
            .from("watch_party_rooms")
            .update({
              current_movie_slug: nextItem.movie_slug,
              movie_image: nextItem.thumb_url,
            })
            .eq("id", room.id);
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
  };

  const executeKick = async () => {
    if (!kickTarget) return;
    setIsKicking(true);
    try {
      await handleParticipantAction(
        kickTarget.user_id,
        "kick",
        kickTarget.profiles?.full_name || "Thành viên",
      );
      toast.success("Đã trục xuất thành viên khỏi phòng");
    } catch (error) {
      console.error("Lỗi khi trục xuất:", error);
      toast.error("Không thể trục xuất thành viên. Vui lòng thử lại.");
    } finally {
      setIsKicking(false);
      setKickTarget(null);
    }
  };

  const handleLeaveRoom = async () => {
    const toastId = toast.loading("Đang rời phòng...");

    try {
      const res = await fetch("/api/watch-party/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roomId: room.id }),
        keepalive: true,
      });

      if (!res.ok) throw new Error();

      toast.success("Hẹn gặp lại bạn nhé! 🍿", { id: toastId });
      router.replace("/xem-chung");
    } catch {
      toast.error("Có lỗi xảy ra, nhưng bạn vẫn có thể rời đi", {
        id: toastId,
      });
      router.replace("/xem-chung");
    }
  };

  // --- CẤU HÌNH TABS ---
  const tabsConfig = useMemo(
    () => [
      { id: "chat", icon: ChatBubbleLeftRightIcon },
      {
        id: "members",
        icon: UserGroupIcon,
        badge: participants.filter((p) => p.status === "pending").length,
      },
      { id: "playlist", icon: QueueListIcon },
      { id: "settings", icon: Cog6ToothIcon, hide: !hasModeratorAuth },
    ],
    [participants, hasModeratorAuth],
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
      <div className="max-w-[1600px] mx-auto mb-6 flex items-center justify-between bg-zinc-900/40 backdrop-blur-md p-4 rounded-xl border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2.5 rounded-xl shadow-lg shadow-red-600/20">
            <PlayIcon className="w-6 h-6 text-white fill-current" />
          </div>
          <div>
            <h1 className="text-base font-black text-white uppercase truncate max-w-[200px] sm:max-w-md">
              {room.title}
            </h1>
            <button
              onClick={() => {
                navigator.clipboard
                  .writeText(room.room_code)
                  .then(() => toast.success("Đã copy mã phòng!"))
                  .catch(() => toast.error("Không thể copy mã phòng"));
              }}
              className="text-[11px] text-zinc-500 flex items-center gap-1 hover:text-red-500 transition-colors"
            >
              Mã phòng:{" "}
              <span className="font-bold text-zinc-300">{room.room_code}</span>
              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <button
          onClick={handleLeaveRoom}
          className="text-xs font-bold bg-zinc-800 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-lg"
        >
          Rời phòng
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
              onPlaySync={(t) => sendControl("play", t)}
              onPauseSync={(t) => sendControl("pause", t)}
              onSeekSync={(t) => sendControl("seek", t)}
              onChangeEpisode={(slug) => handleSelectEpisode(slug)}
              onAutoNext={handleWatchPartyAutoNext}
              onProgress={() => {}}
            >
              <ChatOverlay
                messages={messages}
                currentUserId={user.id}
                onSendMessage={(msg) => {
                  if (msg.text)
                    handleSendMessage(
                      msg.text,
                      (msg.type as "chat" | "system") || "chat",
                    );
                }}
              />
            </VideoPlayer>
          )}

          {movie && (
            <EpisodeSelector
              servers={movie.episodes}
              episodeSelected={activeEpisode?.slug || ""}
              onSelect={(sv) => handleSelectEpisode(sv.slug, sv.name)}
              activeServerIdx={0}
              onServerChange={() => {}}
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
                    onClick={() => setActiveTab(tab.id as TabType)}
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
