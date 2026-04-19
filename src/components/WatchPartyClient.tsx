"use client";

import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import {
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  QueueListIcon,
  Cog6ToothIcon,
  ClipboardDocumentIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";

import dynamic from "next/dynamic";
import EpisodeSelector from "@/components/EpisodeSelector";
import PlaylistTab from "@/components/watch-party/PlaylistTab";
import SettingsTab from "@/components/watch-party/SettingsTab";
import MembersTab from "@/components/watch-party/MembersTab";
import ChatTab, { ChatMessage } from "@/components/watch-party/ChatTab";
import ConfirmModal from "@/components/ConfirmModal";
import { Movie } from "@/types/movie";
import {
  WatchPartyRoom,
  WatchPartyParticipant,
  PlayerSyncRef,
} from "@/types/watch-party";

import {
  useVideoControl,
  useRealtime,
  useHostSuccession,
} from "@/hooks/useWatchParty";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="aspect-video bg-zinc-900 animate-pulse rounded-2xl" />
  ),
});

interface WatchPartyClientProps {
  room: WatchPartyRoom;
  user: User;
  me: WatchPartyParticipant;
}

type TabType = "chat" | "members" | "playlist" | "settings";

export default function WatchPartyClient({
  room: initialRoom,
  user,
  me: initialMe,
}: WatchPartyClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [supabase] = useState(() => createSupabaseClient());

  // --- STATES ---
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [room, setRoom] = useState<WatchPartyRoom>(initialRoom);
  const [startVideoTime, setStartVideoTime] = useState<number>(0);

  // States cho việc Kick
  const [kickTarget, setKickTarget] = useState<WatchPartyParticipant | null>(
    null,
  );
  const [isKicking, setIsKicking] = useState(false);
  const [kickedNoticeOpen, setKickedNoticeOpen] = useState(false);

  // --- REFS ---
  const playerSyncRef = useRef<PlayerSyncRef | null>(null);
  const prevEpisodeRef = useRef(initialRoom.current_episode_slug);

  const handlePlayerReady = useCallback(() => {}, []);

  // --- DATA FETCHING ---
  const { data: movie } = useQuery<Movie>({
    queryKey: ["wp-movie", room.current_movie_slug],
    queryFn: () =>
      fetch(`/api/movies/detail?slug=${room.current_movie_slug}`).then((r) =>
        r.json().then((d) => d.item || d),
      ),
    enabled: !!room.current_movie_slug,
  });

  const { data: participants = [], refetch: refetchParticipants } = useQuery<
    WatchPartyParticipant[]
  >({
    queryKey: ["wp-participants", room.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("watch_party_participants")
        .select(`*, profiles:user_id(full_name, avatar_url)`)
        .eq("room_id", room.id);
      return (data as WatchPartyParticipant[]) || [];
    },
  });

  // --- PHÂN QUYỀN (MEMOIZED) ---
  const meInRoom = useMemo(
    () => participants.find((p) => p.user_id === user.id) || initialMe,
    [participants, user.id, initialMe],
  );

  const isRealHost = meInRoom?.role === "host";

  const hasMediaAuth = useMemo(
    () =>
      isRealHost ||
      !!meInRoom?.permissions?.can_control_media ||
      !!room.settings?.allow_guest_control,
    [isRealHost, meInRoom, room.settings],
  );

  const hasModeratorAuth = useMemo(
    () => isRealHost || !!meInRoom?.permissions?.can_manage_users,
    [isRealHost, meInRoom],
  );

  // --- HANDLERS CHO VIDEO ---
  const handleSyncFromRemote = useCallback(
    (action: "play" | "pause" | "seek", time: number) => {
      playerSyncRef.current?.syncFromRemote(action, time);
    },
    [],
  );

  const handleChangeEpisode = useCallback((newSlug: string) => {
    setRoom((prev) => ({ ...prev, current_episode_slug: newSlug }));
  }, []);

  const handleKicked = useCallback(() => {
    setKickedNoticeOpen(true);
  }, []);

  // --- 1. HOOK ĐIỀU KHIỂN VIDEO & PRESENCE ---
  const { sendControl, presenceData, initialState, isLoadingRoom } =
    useVideoControl(
      room.id,
      user.id,
      hasMediaAuth,
      supabase,
      handleSyncFromRemote,
      handleChangeEpisode,
    );

  // --- 2. HOOK REALTIME (BROADCAST & DB CHANGES) ---
  useRealtime({
    room,
    userId: user.id,
    myParticipantId: meInRoom?.id,
    supabase,
    queryClient,
    isRealHost,
    canControl: hasMediaAuth,
    playerSyncRef,
    setRoom,
    setMessages,
    sendControl,
    refetchParticipants,
    onKicked: handleKicked,
  });

  // --- 3. HOOK KẾ THỪA CHỦ PHÒNG ---
  useHostSuccession(
    participants,
    user.id,
    meInRoom?.id,
    supabase,
    refetchParticipants,
  );

  // Lần đầu vào phòng, lấy thời gian từ Database
  useEffect(() => {
    if (
      initialState?.time !== undefined &&
      prevEpisodeRef.current === initialRoom.current_episode_slug
    ) {
      setStartVideoTime(initialState.time);
    }
  }, [initialState, initialRoom.current_episode_slug]);

  // Bất cứ ai chuyển tập (Host bấm hoặc Khách bị chuyển theo), XÓA VỀ 0
  useEffect(() => {
    if (room.current_episode_slug !== prevEpisodeRef.current) {
      setStartVideoTime(0); // Rơi về 0 ngay lập tức
      prevEpisodeRef.current = room.current_episode_slug;
    }
  }, [room.current_episode_slug]);

  // --- XỬ LÝ CHUYỂN TẬP ---
  const handleSelectEpisode = async (sv: { slug: string }) => {
    if (!hasMediaAuth) return toast.error("Bạn không có quyền đổi tập phim");

    setRoom((prev) => ({ ...prev, current_episode_slug: sv.slug }));

    supabase.channel(`wp_ui_${room.id}`).send({
      type: "broadcast",
      event: "change_episode_sync",
      payload: { slug: sv.slug },
    });

    if (isRealHost) {
      await supabase
        .from("watch_party_rooms")
        .update({ current_episode_slug: sv.slug })
        .eq("id", room.id);
    }
  };

  // --- ACTIONS TRÊN THÀNH VIÊN ---
  const handleParticipantAction = async (
    targetUserId: string,
    action: "approve" | "reject" | "kick",
  ) => {
    if (action === "kick") {
      const target = participants.find((p) => p.user_id === targetUserId);
      if (target) setKickTarget(target);
      return;
    }

    try {
      const res = await fetch("/api/watch-party/participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, targetUserId, action }),
      });

      if (!res.ok) throw new Error("Thao tác thất bại");

      queryClient.setQueryData<WatchPartyParticipant[]>(
        ["wp-participants", room.id],
        (old = []) => {
          if (action === "approve") {
            return old.map((p) =>
              p.user_id === targetUserId ? { ...p, status: "approved" } : p,
            );
          }
          return old.filter((p) => p.user_id !== targetUserId);
        },
      );
      toast.success(action === "approve" ? "Đã duyệt vào phòng" : "Đã từ chối");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đã xảy ra lỗi");
    }
  };

  const executeKick = async () => {
    if (!kickTarget) return;
    setIsKicking(true);
    try {
      const res = await fetch("/api/watch-party/participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          targetUserId: kickTarget.user_id,
          action: "kick",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Không thể trục xuất thành viên");
      }

      toast.success("Đã trục xuất thành viên thành công");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đã xảy ra lỗi");
    } finally {
      setIsKicking(false);
      setKickTarget(null);
      setOpenMenuId(null);
    }
  };

  const togglePermission = async (targetUserId: string, key: string) => {
    queryClient.setQueryData<WatchPartyParticipant[]>(
      ["wp-participants", room.id],
      (old) =>
        old?.map((p) =>
          p.user_id === targetUserId
            ? {
                ...p,
                permissions: {
                  ...p.permissions,
                  [key]: !p.permissions?.[key as keyof typeof p.permissions],
                },
              }
            : p,
        ),
    );

    await fetch("/api/watch-party/participant/permissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: room.id,
        targetUserId,
        permissionKey: key,
      }),
    });
  };

  const handleSendMessage = (msg: ChatMessage) => {
    setMessages((p) => [...p, msg]);
    supabase
      .channel(`wp_ui_${room.id}`)
      .send({ type: "broadcast", event: "chat", payload: msg });
  };

  // --- UI CONFIG ---
  const activeEpisode = useMemo(() => {
    if (!movie?.episodes) return null;
    const allEpisodes = movie.episodes.flatMap((ep) => ep.server_data);
    return (
      allEpisodes.find((e) => e.slug === room.current_episode_slug) ||
      allEpisodes[0]
    );
  }, [movie, room.current_episode_slug]);

  const tabsConfig = [
    { id: "chat", icon: ChatBubbleLeftRightIcon },
    {
      id: "members",
      icon: UserGroupIcon,
      badge: participants.filter((p) => p.status === "pending").length,
    },
    { id: "playlist", icon: QueueListIcon },
    { id: "settings", icon: Cog6ToothIcon, hide: !hasModeratorAuth },
  ];

  // GUARD RENDER
  if (isLoadingRoom || !meInRoom) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 font-medium animate-pulse">
          Đang vào phòng...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 p-4 lg:p-6 pb-20 selection:bg-red-500/30">
      <div className="max-w-[1600px] mx-auto mb-6 flex items-center justify-between bg-zinc-900/40 backdrop-blur-md p-4 rounded-xl border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2.5 rounded-xl shadow-lg shadow-red-600/20">
            <PlayIcon className="w-6 h-6 text-white fill-current" />
          </div>
          <div>
            <h1 className="text-base font-black text-white uppercase tracking-tight line-clamp-1">
              {room.title}
            </h1>
            <button
              onClick={() => {
                navigator.clipboard.writeText(room.room_code);
                toast.success("Đã copy mã phòng!");
              }}
              className="text-[11px] text-zinc-500 flex items-center gap-1 transition-colors"
            >
              Mã phòng:{" "}
              <span className="text-zinc-300 hover:text-red-500 font-bold">
                {room.room_code}
              </span>
              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <button
          onClick={() => router.replace("/xem-chung")}
          className="text-xs font-bold bg-zinc-800 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg active:scale-95"
        >
          Rời phòng
        </button>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 2xl:col-span-9 space-y-4">
          {activeEpisode && movie && (
            <VideoPlayer
              key={activeEpisode.slug}
              playerSyncRef={playerSyncRef}
              movieSrc={activeEpisode.link_m3u8}
              user={user}
              movie={movie}
              isWatchParty={true}
              isHost={isRealHost}
              canControl={hasMediaAuth}
              initialTime={startVideoTime}
              onPlaySync={(t) => sendControl("play", t)}
              onPauseSync={(t) => sendControl("pause", t)}
              onSeekSync={(t) => sendControl("seek", t)}
              onProgress={() => {}}
              onPlayerReady={handlePlayerReady}
              onChangeEpisode={(slug) => handleSelectEpisode({ slug })}
              onAutoNext={() => {
                if (!hasMediaAuth) return;
                const allEpisodes = movie.episodes.flatMap(
                  (ep) => ep.server_data,
                );
                const currentIndex = allEpisodes.findIndex(
                  (e) => e.slug === room.current_episode_slug,
                );
                const nextEpisode = allEpisodes[currentIndex + 1];
                if (nextEpisode) {
                  toast.info("Đang tự động chuyển sang tập tiếp theo...");
                  handleSelectEpisode(nextEpisode);
                }
              }}
            />
          )}

          {movie && (
            <EpisodeSelector
              servers={movie.episodes}
              episodeSelected={activeEpisode?.slug || ""}
              onSelect={handleSelectEpisode}
              activeServerIdx={0}
              onServerChange={() => {}}
            />
          )}
        </div>

        <div className="xl:col-span-4 2xl:col-span-3 flex flex-col bg-zinc-900/30 rounded-xl border border-zinc-800 h-[650px] xl:h-[calc(100vh-140px)] overflow-hidden shadow-2xl backdrop-blur-sm">
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
                        : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    {tab.badge && tab.badge > 0 ? (
                      <span className="absolute top-1.5 right-2 min-w-[14px] h-4 bg-red-600 text-white text-[10px] font-black flex items-center justify-center rounded-full px-1 shadow-md shadow-red-900/50">
                        {tab.badge}
                      </span>
                    ) : null}
                  </button>
                ),
            )}
          </div>

          <div className="flex-1 p-4 overflow-hidden relative">
            {activeTab === "chat" && (
              <ChatTab
                messages={messages}
                user={user}
                room={room}
                isHost={isRealHost}
                onSendMessage={handleSendMessage}
              />
            )}
            {activeTab === "members" && (
              <MembersTab
                participants={participants}
                presenceData={presenceData}
                isRealHost={isRealHost}
                canManageUsers={hasModeratorAuth}
                user={user}
                room={room}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                onAction={handleParticipantAction}
                onTogglePermission={togglePermission}
              />
            )}
            {activeTab === "playlist" && (
              <PlaylistTab room={room} canManage={hasMediaAuth} />
            )}
            {activeTab === "settings" && (
              <SettingsTab room={room} setRoom={setRoom} />
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!kickTarget}
        isLoading={isKicking}
        title="Trục xuất thành viên"
        description={`Bạn có chắc chắn muốn đuổi "${kickTarget?.profiles?.full_name}" ra khỏi phòng?`}
        confirmText="Trục xuất"
        cancelText="Hủy bỏ"
        variant="danger"
        onClose={() => setKickTarget(null)}
        onConfirm={executeKick}
      />

      <ConfirmModal
        isOpen={kickedNoticeOpen}
        isLoading={false}
        title="Thông báo trục xuất"
        description="Rất tiếc, chủ phòng đã mời bạn rời khỏi phiên xem chung này."
        confirmText="Quay lại trang chủ"
        cancelText="Đóng"
        variant="primary"
        onClose={() => router.replace("/xem-chung")}
        onConfirm={() => router.replace("/xem-chung")}
      />
    </div>
  );
}
