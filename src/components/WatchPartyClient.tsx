"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PaperAirplaneIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  QueueListIcon,
  Cog6ToothIcon,
  ClipboardDocumentIcon,
  PlayIcon,
  CheckIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";

import dynamic from "next/dynamic";
import EpisodeSelector from "@/components/EpisodeSelector";
import PlaylistTab from "@/components/watch-party/PlaylistTab";
import SettingsTab from "@/components/watch-party/SettingsTab";
import { Movie } from "@/types";
import { useWatchParty } from "@/hooks/useWatchParty";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="aspect-video bg-zinc-900 animate-pulse rounded-2xl" />
  ),
});

export default function WatchPartyClient({
  room: initialRoom,
  user,
  me: initialMe,
}: any) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const playerSyncRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseClient();

  const [activeTab, setActiveTab] = useState<
    "chat" | "members" | "playlist" | "settings"
  >("chat");
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [room, setRoom] = useState(initialRoom);

  const { sendControl, presenceData, isLoadingRoom } = useWatchParty(
    room.id,
    initialMe.role === "host",
    (action, time) => playerSyncRef.current?.syncFromRemote(action, time),
    (newSlug) =>
      setRoom((prev: any) => ({ ...prev, current_episode_slug: newSlug })),
  );

  const { data: movie } = useQuery<Movie>({
    queryKey: ["wp-movie", room.current_movie_slug],
    queryFn: () =>
      fetch(`/api/movies/detail?slug=${room.current_movie_slug}`).then((r) =>
        r.json().then((d) => d.item || d),
      ),
    enabled: !!room.current_movie_slug,
  });

  const { data: participants = [], refetch: refetchParticipants } = useQuery({
    queryKey: ["wp-participants", room.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("watch_party_participants")
        .select(`*, profiles:user_id(full_name, avatar_url)`)
        .eq("room_id", room.id);
      return data || [];
    },
  });

  const me = participants.find((p: any) => p.user_id === user.id) || initialMe;
  const isHost = me.role === "host";
  const canControlVideo =
    isHost ||
    me.permissions?.can_control_video ||
    room.settings?.allow_guest_control;
  const canChangeMovie = isHost || me.permissions?.can_change_movie;

  const canControlRef = useRef(canControlVideo);
  useEffect(() => {
    canControlRef.current = canControlVideo;
  }, [canControlVideo]);

  useEffect(() => {
    const channel = supabase
      .channel(`wp_engine_${room.id}`)
      .on("broadcast", { event: "chat" }, ({ payload }) =>
        setMessages((p) => [...p, payload]),
      )
      .on("broadcast", { event: "video_control" }, ({ payload }) => {
        if (!canControlRef.current)
          playerSyncRef.current?.syncFromRemote(payload.action, payload.time);
      })
      .on("broadcast", { event: "playlist_updated" }, () => {
        queryClient.invalidateQueries({ queryKey: ["wp-playlist", room.id] });
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "watch_party_rooms",
          filter: `id=eq.${room.id}`,
        },
        (p) => setRoom(p.new),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watch_party_participants",
          filter: `room_id=eq.${room.id}`,
        },
        (p: any) => {
          refetchParticipants();
          if (p.new?.user_id === user.id && p.new?.status === "blocked") {
            toast.error("Bạn đã bị mời ra khỏi phòng");
            router.push("/xem-chung");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, user.id, queryClient, refetchParticipants, router, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeEpisode = useMemo(() => {
    if (!movie) return null;
    return movie.episodes
      .flatMap((ep) => ep.server_data)
      .find((e) => e.slug === room.current_episode_slug);
  }, [movie, room.current_episode_slug]);

  const togglePermission = async (targetUserId: string, key: string) => {
    queryClient.setQueryData(["wp-participants", room.id], (old: any) =>
      old?.map((p: any) =>
        p.user_id === targetUserId
          ? {
              ...p,
              permissions: { ...p.permissions, [key]: !p.permissions?.[key] },
            }
          : p,
      ),
    );
    await fetch("/api/watch-party/participant/permissions", {
      method: "PATCH",
      body: JSON.stringify({
        roomId: room.id,
        targetUserId,
        permissionKey: key,
      }),
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 p-4 lg:p-6 pb-20">
      {/* HEADER PHÒNG - PHỤC HỒI */}
      <div className="max-w-[1600px] mx-auto mb-6 flex items-center justify-between bg-zinc-900/40 backdrop-blur-md p-4 rounded-2xl border border-zinc-800">
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
                toast.success("Đã copy mã!");
              }}
              className="text-[11px] text-zinc-500 hover:text-red-500 flex items-center gap-1 transition"
            >
              Mã phòng:{" "}
              <span className="font-mono text-zinc-300 font-bold">
                {room.room_code}
              </span>{" "}
              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
              Live Sync
            </span>
          </div>
          <button
            onClick={() => router.push("/xem-chung")}
            className="text-xs font-bold bg-zinc-800 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl transition shadow-lg"
          >
            Rời phòng
          </button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* PLAYER */}
        <div className="xl:col-span-8 2xl:col-span-9 space-y-4 relative">
          {!canControlVideo && (
            <div
              className="absolute inset-0 z-50 pointer-events-auto cursor-not-allowed"
              onClick={() =>
                toast.warning("Chế độ chỉ xem. Chỉ Host được phép điều khiển.")
              }
            />
          )}
          <div className="bg-black aspect-video rounded-[2.5rem] overflow-hidden border border-zinc-800 shadow-2xl relative">
            {activeEpisode && movie ? (
              <VideoPlayer
                playerSyncRef={playerSyncRef}
                user={user}
                movie={movie}
                movieSrc={activeEpisode.link_m3u8}
                movieName={movie.name}
                isWatchParty={true}
                isHost={canControlVideo}
                onPlaySync={(t) => sendControl("play", t)}
                onPauseSync={(t) => sendControl("pause", t)}
                onSeekSync={(t) => sendControl("seek", t)}
                onProgress={() => {}}
                onAutoNext={() => {}}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-600 italic">
                Đang tải phim...
              </div>
            )}
          </div>
          {movie && (
            <div className="bg-zinc-900/20 p-4 rounded-3xl border border-zinc-800 relative z-[60]">
              <EpisodeSelector
                servers={movie.episodes}
                episodeSelected={room.current_episode_slug}
                onSelect={(sv) =>
                  canChangeMovie
                    ? sendControl("play", 0, sv.slug)
                    : toast.error("Bạn không có quyền đổi tập")
                }
                activeServerIdx={0}
                onServerChange={() => {}}
              />
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="xl:col-span-4 2xl:col-span-3 flex flex-col bg-zinc-900/30 rounded-[2.5rem] border border-zinc-800 h-[650px] xl:h-[calc(100vh-140px)] overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="flex p-1.5 bg-zinc-950/40 border-b border-zinc-800 shrink-0">
            {[
              { id: "chat", icon: ChatBubbleLeftRightIcon },
              {
                id: "members",
                icon: UserGroupIcon,
                badge: participants.filter((p: any) => p.status === "pending")
                  .length,
              },
              { id: "playlist", icon: QueueListIcon },
              { id: "settings", icon: Cog6ToothIcon, hide: !isHost },
            ].map(
              (tab: any) =>
                !tab.hide && (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-3 flex justify-center rounded-2xl transition relative ${activeTab === tab.id ? "bg-zinc-800 text-red-500 shadow-sm" : "text-zinc-600 hover:text-zinc-400"}`}
                  >
                    <tab.icon className="w-5 h-5" />
                    {tab.badge > 0 && (
                      <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    )}
                  </button>
                ),
            )}
          </div>

          <div className="flex-1 p-4 overflow-hidden relative">
            {activeTab === "chat" && (
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {messages.length === 0 && (
                    <div className="h-full flex items-center justify-center text-zinc-700 text-xs italic">
                      Chưa có tin nhắn nào...
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col ${msg.user_id === user.id ? "items-end" : "items-start"}`}
                    >
                      <span className="text-[10px] text-zinc-500 mb-1 px-1">
                        {msg.user_name}
                      </span>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm max-w-[85%] ${msg.user_id === user.id ? "bg-red-600 text-white rounded-tr-none" : "bg-zinc-800 text-zinc-300 rounded-tl-none border border-zinc-700/50 shadow-sm"}`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (
                      !chatMessage.trim() ||
                      (!room.settings?.guest_can_chat && !isHost)
                    )
                      return;
                    const m = {
                      user_id: user.id,
                      user_name: user.user_metadata?.full_name || "Guest",
                      text: chatMessage,
                    };
                    setMessages((p) => [...p, m]);
                    setChatMessage("");
                    supabase
                      .channel(`wp_engine_${room.id}`)
                      .send({ type: "broadcast", event: "chat", payload: m });
                  }}
                  className="mt-4 flex gap-2"
                >
                  <input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    disabled={!room.settings?.guest_can_chat && !isHost}
                    placeholder="Nhập tin nhắn..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-red-600"
                  />
                  <button className="bg-red-600 p-3 rounded-2xl hover:bg-red-700 transition active:scale-95">
                    <PaperAirplaneIcon className="w-5 h-5 text-white" />
                  </button>
                </form>
              </div>
            )}

            {activeTab === "members" && (
              <div className="h-full overflow-y-auto space-y-6 custom-scrollbar pr-2">
                {/* 1. CHỜ DUYỆT */}
                {isHost &&
                  participants.some((p: any) => p.status === "pending") && (
                    <div className="space-y-2 animate-in slide-in-from-top-4">
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest px-1">
                        Yêu cầu tham gia
                      </p>
                      {participants
                        .filter((p: any) => p.status === "pending")
                        .map((p: any) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2.5 bg-red-500/5 rounded-2xl border border-red-500/20"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={
                                  p.profiles?.avatar_url ||
                                  "/default-avatar.png"
                                }
                                className="w-8 h-8 rounded-full object-cover shadow-sm"
                              />
                              <span className="text-xs font-bold truncate text-white">
                                {p.profiles?.full_name}
                              </span>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() =>
                                  fetch("/api/watch-party/participant", {
                                    method: "POST",
                                    body: JSON.stringify({
                                      roomId: room.id,
                                      targetUserId: p.user_id,
                                      action: "approve",
                                    }),
                                  })
                                }
                                className="p-2 bg-emerald-600 rounded-xl hover:bg-emerald-500 transition"
                              >
                                <CheckIcon className="w-4 h-4 text-white" />
                              </button>
                              <button
                                onClick={() =>
                                  fetch("/api/watch-party/participant", {
                                    method: "POST",
                                    body: JSON.stringify({
                                      roomId: room.id,
                                      targetUserId: p.user_id,
                                      action: "reject",
                                    }),
                                  })
                                }
                                className="p-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition"
                              >
                                <XMarkIcon className="w-4 h-4 text-white" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                {/* 2. ĐANG TRONG PHÒNG */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1 mb-3">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      Thành viên (
                      {
                        participants.filter((p: any) => p.status === "approved")
                          .length
                      }
                      )
                    </p>
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg font-bold">
                      {
                        participants.filter((p: any) => p.status === "approved")
                          .length
                      }
                      /{room.max_participants}
                    </span>
                  </div>

                  {participants
                    .filter((p: any) => p.status === "approved")
                    .map((p: any) => {
                      const pres = presenceData[p.user_id];
                      // Logic màu sắc: Presence data không có -> Đỏ, Có + 'online' -> Xanh, Có + 'away' -> Vàng
                      const statusColor = !pres
                        ? "bg-zinc-600"
                        : pres.status === "online"
                          ? "bg-emerald-500"
                          : "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]";

                      return (
                        <div
                          key={p.id}
                          className="group relative flex items-center gap-3 p-2.5 hover:bg-zinc-800/40 rounded-2xl transition border border-transparent hover:border-zinc-800"
                        >
                          <div className="relative shrink-0">
                            <img
                              src={
                                p.profiles?.avatar_url || "/default-avatar.png"
                              }
                              className="w-10 h-10 rounded-full border-2 border-zinc-800 object-cover shadow-md"
                            />
                            <div
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${statusColor} border-[3px] border-[#18181b] rounded-full transition-colors`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-bold truncate flex items-center gap-2 ${p.role === "host" ? "text-red-500" : "text-zinc-200"}`}
                            >
                              {p.profiles?.full_name}
                              {p.user_id === user.id && (
                                <span className="bg-white/10 text-white text-[9px] px-1.5 py-0.5 rounded font-black tracking-tighter">
                                  BẠN
                                </span>
                              )}
                            </p>
                            <div className="flex gap-1.5 mt-0.5">
                              {p.permissions?.can_control_video && (
                                <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black tracking-widest">
                                  REMOTE
                                </span>
                              )}
                              {p.permissions?.can_change_movie && (
                                <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-black tracking-widest">
                                  EDIT
                                </span>
                              )}
                            </div>
                          </div>
                          {isHost && p.user_id !== user.id && (
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setOpenMenuId(
                                    openMenuId === p.id ? null : p.id,
                                  )
                                }
                                className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition"
                              >
                                <EllipsisVerticalIcon className="w-5 h-5" />
                              </button>
                              {openMenuId === p.id && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 origin-top-right border-t-red-600/50 border-t-2">
                                  <div className="p-2.5 space-y-1">
                                    <p className="text-[10px] text-zinc-500 uppercase font-black px-2 py-1.5">
                                      Phân quyền nhanh
                                    </p>
                                    <div
                                      onClick={() =>
                                        togglePermission(
                                          p.user_id,
                                          "can_control_video",
                                        )
                                      }
                                      className="flex items-center justify-between p-2.5 hover:bg-zinc-800 rounded-xl cursor-pointer transition group/item"
                                    >
                                      <span className="text-xs text-zinc-300 group-hover/item:text-white">
                                        Điều khiển Video
                                      </span>
                                      <div
                                        className={`w-8 h-4.5 rounded-full relative transition-colors ${p.permissions?.can_control_video ? "bg-emerald-500" : "bg-zinc-800 border border-zinc-700"}`}
                                      >
                                        <div
                                          className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all shadow-sm ${p.permissions?.can_control_video ? "left-4" : "left-0.5"}`}
                                        />
                                      </div>
                                    </div>
                                    <div
                                      onClick={() =>
                                        togglePermission(
                                          p.user_id,
                                          "can_change_movie",
                                        )
                                      }
                                      className="flex items-center justify-between p-2.5 hover:bg-zinc-800 rounded-xl cursor-pointer transition group/item"
                                    >
                                      <span className="text-xs text-zinc-300 group-hover/item:text-white">
                                        Chọn/Đổi Phim
                                      </span>
                                      <div
                                        className={`w-8 h-4.5 rounded-full relative transition-colors ${p.permissions?.can_change_movie ? "bg-emerald-500" : "bg-zinc-800 border border-zinc-700"}`}
                                      >
                                        <div
                                          className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all shadow-sm ${p.permissions?.can_change_movie ? "left-4" : "left-0.5"}`}
                                        />
                                      </div>
                                    </div>
                                    <div className="h-px bg-zinc-800 my-2 mx-1" />
                                    <button
                                      onClick={() =>
                                        fetch("/api/watch-party/participant", {
                                          method: "POST",
                                          body: JSON.stringify({
                                            roomId: room.id,
                                            targetUserId: p.user_id,
                                            action: "reject",
                                          }),
                                        })
                                      }
                                      className="w-full text-left p-2.5 text-xs text-red-500 hover:bg-red-500/10 rounded-xl transition flex items-center gap-3 font-bold"
                                    >
                                      <XMarkIcon className="w-4 h-4" /> Trục
                                      xuất khỏi phòng
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {activeTab === "playlist" && (
              <PlaylistTab room={room} canManage={canChangeMovie} />
            )}
            {activeTab === "settings" && (
              <SettingsTab room={room} setRoom={setRoom} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
