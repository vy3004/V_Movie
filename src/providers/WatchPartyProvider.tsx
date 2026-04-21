"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  useQuery,
  useQueryClient,
  QueryObserverResult,
  RefetchOptions,
  RefetchQueryFilters,
} from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";

import {
  useHostSuccession,
  usePlaylistManager,
  useRealtime,
  useVideoControl,
} from "@/hooks/useWatchParty";

import { createSupabaseClient } from "@/lib/supabase/client";
import {
  WatchPartyRoom,
  WatchPartyParticipant,
  ChatMessage,
  PlayerSyncRef,
  UserPresence,
  PlaylistItem,
  Movie,
} from "@/types";

interface WatchPartyContextType {
  room: WatchPartyRoom;
  setRoom: React.Dispatch<React.SetStateAction<WatchPartyRoom>>;
  user: User;
  participants: WatchPartyParticipant[];
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  presenceData: Record<string, UserPresence>;
  playerSyncRef: React.MutableRefObject<PlayerSyncRef | null>;

  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  kickTarget: WatchPartyParticipant | null;
  setKickTarget: React.Dispatch<
    React.SetStateAction<WatchPartyParticipant | null>
  >;
  isKicked: boolean;

  myParticipant: WatchPartyParticipant | undefined;
  isRealHost: boolean;
  canControl: boolean;
  hasModeratorAuth: boolean;

  sendControl: (
    action: "play" | "pause" | "seek",
    time: number,
    slug?: string,
  ) => void;
  isLoadingRoom: boolean;
  initialState: { time?: number; isPaused?: boolean } | null;
  handleSelectEpisode: (
    slug: string,
    name?: string,
  ) => Promise<string | number | void>;

  playlist: PlaylistItem[];
  handleAddMovie: (
    movie: Movie,
    onSuccess: () => void,
  ) => Promise<string | number | void>;
  handlePlayNow: (item: PlaylistItem) => Promise<void>;
  handleDeleteItem: (id: string) => Promise<void>;
  handleDragStart: (e: React.DragEvent, index: number) => void;
  handleDragEnter: (e: React.DragEvent, index: number) => void;
  handleDragEnd: (e: React.DragEvent) => Promise<void>;

  handleSendMessage: (text: string, type?: "chat" | "system") => Promise<void>;
  sendSystemMessage: (text: string) => Promise<void>;
  handleParticipantAction: (
    targetUserId: string,
    action: "approve" | "reject" | "kick",
    targetName?: string,
  ) => Promise<string | number | void>;
  togglePermission: (
    targetUserId: string,
    key: string,
  ) => Promise<string | number | void>;
  refetchParticipants: (
    options?:
      | (RefetchOptions & RefetchQueryFilters<WatchPartyParticipant[]>)
      | undefined,
  ) => Promise<QueryObserverResult<WatchPartyParticipant[], Error>>;
}

const WatchPartyContext = createContext<WatchPartyContextType | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  roomId: string;
  user: User;
  initialRoom: WatchPartyRoom;
  initialMe: WatchPartyParticipant;
}

export function WatchPartyProvider({
  children,
  roomId,
  user,
  initialRoom,
  initialMe,
}: ProviderProps) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const queryClient = useQueryClient();

  const [room, setRoom] = useState<WatchPartyRoom>(initialRoom);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [kickTarget, setKickTarget] = useState<WatchPartyParticipant | null>(
    null,
  );
  const [isKicked, setIsKicked] = useState(false);
  const playerSyncRef = useRef<PlayerSyncRef | null>(null);

  const { data: participants = [], refetch: refetchParticipants } = useQuery<
    WatchPartyParticipant[]
  >({
    queryKey: ["wp-participants", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watch_party_participants")
        .select(`*, profiles:user_id(full_name, avatar_url)`)
        .eq("room_id", roomId);
      if (error) throw error;
      return (data as WatchPartyParticipant[]) || [];
    },
  });

  const myParticipant = useMemo(
    () => participants.find((p) => p.user_id === user.id) || initialMe,
    [participants, user.id, initialMe],
  );

  const isRealHost = useMemo(
    () => myParticipant?.role === "host",
    [myParticipant],
  );

  const canControl = useMemo(
    () =>
      isRealHost ||
      !!myParticipant?.permissions?.can_control_media ||
      !!room.settings?.allow_guest_control,
    [isRealHost, myParticipant, room.settings],
  );

  const hasModeratorAuth = useMemo(
    () => isRealHost || !!myParticipant?.permissions?.can_manage_users,
    [isRealHost, myParticipant],
  );

  // --- HÀM GỬI TIN NHẮN LOCAL (CHỈ HIỂN THỊ TRÊN MÁY NGƯỜI XEM) ---
  const addLocalSystemMessage = useCallback(
    (text: string) => {
      setMessages((prev) => {
        const newMsg: ChatMessage = {
          id: crypto.randomUUID(),
          room_id: roomId,
          user_id: "system",
          user_name: "Hệ thống",
          avatar_url: "",
          text,
          type: "system",
          created_at: new Date().toISOString(),
        };
        const updated = [...prev, newMsg];
        return updated.length > 150 ? updated.slice(-150) : updated;
      });
    },
    [roomId],
  );

  const handleSendMessage = useCallback(
    async (msgText: string, type: "chat" | "system" = "chat") => {
      const clientMsgId = crypto.randomUUID();
      const optimisticMsg: ChatMessage = {
        id: clientMsgId,
        room_id: roomId,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || "Guest",
        avatar_url: user.user_metadata?.avatar_url || "",
        text: msgText,
        type: type,
        created_at: new Date().toISOString(),
        status: "sending",
      };

      setMessages((prev) => {
        const updated = [...prev, optimisticMsg];
        return updated.length > 150 ? updated.slice(-150) : updated;
      });

      try {
        const res = await fetch("/api/watch-party/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: clientMsgId,
            roomId,
            text: msgText,
            type,
          }),
        });
        if (!res.ok) throw new Error();
        const savedMsg = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === clientMsgId ? { ...savedMsg, status: undefined } : m,
          ),
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === clientMsgId ? { ...m, status: "error" } : m,
          ),
        );
      }
    },
    [roomId, user],
  );

  const sendSystemMessage = useCallback(
    async (text: string) => {
      await handleSendMessage(text, "system");
    },
    [handleSendMessage],
  );

  const handleParticipantAction = useCallback(
    async (
      targetUserId: string,
      action: "approve" | "reject" | "kick",
      targetName?: string,
    ) => {
      try {
        const res = await fetch("/api/watch-party/participant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, targetUserId, action }),
        });
        if (!res.ok) throw new Error("Thao tác thất bại");

        queryClient.setQueryData<WatchPartyParticipant[]>(
          ["wp-participants", roomId],
          (old = []) => {
            if (action === "approve")
              return old.map((p) =>
                p.user_id === targetUserId ? { ...p, status: "approved" } : p,
              );
            return old.filter((p) => p.user_id !== targetUserId);
          },
        );

        if (action === "approve") {
          await sendSystemMessage(
            `✅ ${targetName || "Thành viên"} đã được duyệt vào phòng`,
          );
        } else if (action === "kick") {
          await sendSystemMessage(
            `🚫 ${targetName || "Thành viên"} đã bị trục xuất`,
          );
        }

        return toast.success(
          action === "approve"
            ? "Đã duyệt"
            : action === "kick"
              ? "Đã trục xuất"
              : "Đã từ chối",
        );
      } catch (e) {
        return toast.error(e instanceof Error ? e.message : "Lỗi hệ thống");
      }
    },
    [roomId, queryClient, sendSystemMessage],
  );

  const togglePermission = useCallback(
    async (targetUserId: string, key: string) => {
      queryClient.setQueryData<WatchPartyParticipant[]>(
        ["wp-participants", roomId],
        (old) =>
          old?.map((p) =>
            p.user_id === targetUserId
              ? {
                  ...p,
                  permissions: {
                    ...p.permissions,
                    [key]: !p.permissions?.[key as keyof typeof p.permissions],
                  },
                  is_muted: key === "is_muted" ? !p.is_muted : p.is_muted,
                }
              : p,
          ),
      );
      try {
        const res = await fetch("/api/watch-party/participant/permissions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, targetUserId, permissionKey: key }),
        });
        if (!res.ok) throw new Error();
      } catch {
        refetchParticipants();
        return toast.error("Lỗi cập nhật quyền");
      }
    },
    [roomId, queryClient, refetchParticipants],
  );

  const handleSelectEpisode = useCallback(
    async (slug: string, name?: string) => {
      if (!canControl) return toast.error("Bạn không có quyền đổi tập phim");

      let originalSlug: string | null | undefined;
      setRoom((prev) => {
        originalSlug = prev.current_episode_slug;
        return { ...prev, current_episode_slug: slug } as WatchPartyRoom;
      });

      if (isRealHost) {
        const { error } = await supabase
          .from("watch_party_rooms")
          .update({ current_episode_slug: slug })
          .eq("id", room.id);

        if (error) {
          console.error("Failed to update room episode:", error);
          setRoom(
            (prev) =>
              ({
                ...prev,
                current_episode_slug: originalSlug,
              }) as WatchPartyRoom,
          );
          return toast.error("Lỗi đồng bộ với máy chủ!");
        }
      }

      await supabase.channel(`wp_ui_${room.id}`).send({
        type: "broadcast",
        event: "change_episode_sync",
        payload: { slug },
      });

      await sendSystemMessage(
        `🎬 ${user.user_metadata?.full_name || "Thành viên"} đã chuyển sang ${name || "tập mới"}`,
      );
    },
    [canControl, isRealHost, room.id, supabase, user, sendSystemMessage],
  );

  const {
    sendControl,
    presenceData,
    isLoadingRoom,
    initialState,
  }: {
    sendControl: (
      action: "play" | "pause" | "seek",
      time: number,
      slug?: string,
    ) => void;
    presenceData: Record<string, UserPresence>;
    isLoadingRoom: boolean;
    initialState: { time?: number; isPaused?: boolean } | null;
  } = useVideoControl(
    roomId,
    user.id,
    canControl,
    supabase,
    (action, time) => playerSyncRef.current?.syncFromRemote(action, time),
    (slug) => setRoom((prev) => ({ ...prev, current_episode_slug: slug })),
  );

  // THEO DÕI REALTIME ĐỂ PHÁT HIỆN NGƯỜI RA/VÀO (KHÔNG LƯU DB)
  const prevPresence = useRef<Record<string, UserPresence>>({});
  const isPresenceInitialized = useRef(false);

  useEffect(() => {
    const currentIds = Object.keys(presenceData);

    // Đợi fetch đủ danh sách để lấy tên cho chuẩn
    if (!isPresenceInitialized.current) {
      if (participants.length > 0) {
        prevPresence.current = presenceData;
        isPresenceInitialized.current = true;
      }
      return;
    }

    const prevIds = Object.keys(prevPresence.current);

    // Tìm ra những ai mới kết nối và những ai vừa ngắt kết nối (bỏ qua bản thân)
    const joined = currentIds.filter(
      (id) => !prevIds.includes(id) && id !== user.id,
    );
    const left = prevIds.filter(
      (id) => !currentIds.includes(id) && id !== user.id,
    );

    joined.forEach((id) => {
      const p = participants.find((p) => p.user_id === id);
      const name = p?.profiles?.full_name || "Một thành viên";
      addLocalSystemMessage(`👋 ${name} đã kết nối`);
    });

    left.forEach((id) => {
      const p = participants.find((p) => p.user_id === id);
      const name = p?.profiles?.full_name || "Một thành viên";
      addLocalSystemMessage(`🚪 ${name} đã ngắt kết nối`);
    });

    prevPresence.current = presenceData;
  }, [presenceData, participants, addLocalSystemMessage, user.id]);

  useRealtime({
    room,
    userId: user.id,
    myParticipantId: myParticipant?.id,
    supabase,
    queryClient,
    isRealHost,
    canControl,
    playerSyncRef,
    setRoom,
    setMessages,
    sendControl,
    refetchParticipants,
    onKicked: () => {
      setIsKicked(true);
    },
  });

  const playlistManager = usePlaylistManager(room, user, sendSystemMessage);

  useHostSuccession({
    participants,
    presenceData,
    myId: user.id,
    myParticipantId: myParticipant?.id,
    supabase,
    refetch: refetchParticipants,
    isActive: room?.is_active ?? true,
  });

  useEffect(() => {
    const controller = new AbortController();
    let isCancelled = false;

    const fetchMessages = async () => {
      // CHỈ FETCH KHI ĐÃ XÁC NHẬN MÌNH LÀ THÀNH VIÊN
      const isMeInList = participants.some((p) => p.user_id === user.id);
      if (!isMeInList) return;

      try {
        const res = await fetch(`/api/watch-party/messages?roomId=${roomId}`, {
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && !isCancelled) {
            // MERGE TIN NHẮN: Không làm mất các thông báo "đã kết nối" đang có
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const newHistory = data.filter((m) => !existingIds.has(m.id));

              // Sắp xếp lại theo thời gian để tin nhắn cũ lên đầu
              return [...newHistory, ...prev].sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
              );
            });
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        console.error("Lỗi fetch tin nhắn:", e);
      }
    };

    // Chạy fetch. roomId và participants.length thay đổi sẽ trigger lại nếu hụt lần đầu
    if (roomId) fetchMessages();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [roomId, participants, user.id]);

  const contextValue = useMemo<WatchPartyContextType>(
    () => ({
      room,
      setRoom,
      user,
      participants,
      messages,
      setMessages,
      presenceData,
      playerSyncRef,

      openMenuId,
      setOpenMenuId,
      kickTarget,
      setKickTarget,
      isKicked,

      myParticipant,
      isRealHost,
      canControl,
      hasModeratorAuth,

      sendControl,
      isLoadingRoom,
      initialState,
      handleSelectEpisode,

      handleSendMessage,
      sendSystemMessage,
      handleParticipantAction,
      togglePermission,
      refetchParticipants,

      ...playlistManager,
    }),
    [
      room,
      participants,
      messages,
      presenceData,
      openMenuId,
      kickTarget,
      isKicked,
      myParticipant,
      isRealHost,
      canControl,
      hasModeratorAuth,
      sendControl,
      isLoadingRoom,
      initialState,
      handleSelectEpisode,
      handleSendMessage,
      sendSystemMessage,
      handleParticipantAction,
      togglePermission,
      playlistManager,
      user,
      refetchParticipants,
    ],
  );

  return (
    <WatchPartyContext.Provider value={contextValue}>
      {children}
    </WatchPartyContext.Provider>
  );
}

export const useWatchParty = (): WatchPartyContextType => {
  const context = useContext(WatchPartyContext);
  if (!context)
    throw new Error("useWatchParty must be used within a WatchPartyProvider");
  return context;
};
