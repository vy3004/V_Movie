"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useMemo,
  useEffect,
  useLayoutEffect,
} from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import {
  PlayerSyncRef,
  UserProfile,
  WatchPartyRoom,
  WatchPartyParticipant,
  PlaylistItem,
  ChatMessage,
} from "@/types";
import {
  usePlaybackRealtime,
  WatchPartyPlayback,
} from "@/features/watch-party/playback-sync";
import {
  selectCanControl,
  selectMyParticipant,
  useWatchPartyStore,
} from "@/stores/watch-party";

interface WatchPartyContextType {
  playerSyncRef: React.MutableRefObject<PlayerSyncRef | null>;
  sendControl: (
    action: "play" | "pause" | "seek",
    time: number,
    slug?: string,
  ) => void;
  sendHeartbeat: (time: number, isPaused: boolean) => void;
  applyInitialState: () => void;
  requestControllerSync: () => void;
  isLoadingRoom: boolean;
  initialState: { time?: number; isPaused?: boolean } | null;
  activeControllerId?: string;
  activeControllerName?: string;
}

const WatchPartyContext = createContext<WatchPartyContextType | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  roomId: string;
  user: UserProfile;
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
  const playerSyncRef = useRef<PlayerSyncRef | null>(null);

  const hydratedRoomId = useRef<string | null>(null);
  const participantsLoadedRef = useRef(false);

  useLayoutEffect(() => {
    if (hydratedRoomId.current === roomId) return;

    const isSwitchingRoom =
      hydratedRoomId.current !== null && hydratedRoomId.current !== roomId;
    const store = useWatchPartyStore.getState();
    store.setRoom(initialRoom);
    store.setUser(user);
    store.setMyParticipantId(initialMe.id);
    store.setParticipants([]);
    store.setPlaylist([]);
    store.setWantsVoiceConnected(false);
    store.setIsVoiceConnected(false);
    if (isSwitchingRoom) store.clearMessages();
    useWatchPartyStore.setState({ presenceData: {} });
    participantsLoadedRef.current = false;
    hydratedRoomId.current = roomId;
  }, [initialMe.id, initialRoom, roomId, user]);

  useEffect(() => {
    let cancelled = false;

    const fetchInitialData = async () => {
      const [
        { data: participants, error: participantsError },
        { data: playlist, error: playlistError },
        { data: messages, error: messagesError },
      ] = await Promise.all([
        supabase
          .from("watch_party_participants")
          .select(`*, profiles:user_id(full_name, avatar_url)`)
          .eq("room_id", roomId),
        supabase
          .from("watch_party_playlist")
          .select("*")
          .eq("room_id", roomId),
        supabase
          .from("watch_party_messages")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (cancelled || hydratedRoomId.current !== roomId) return;

      const store = useWatchPartyStore.getState();

      if (!participantsError && participants) {
        store.setParticipants(participants as WatchPartyParticipant[]);
        participantsLoadedRef.current = true;
      }

      if (!playlistError && playlist) {
        store.setPlaylist(playlist as PlaylistItem[]);
      }

      if (!messagesError && messages) {
        store.addMessages([...messages].reverse() as ChatMessage[]);
      }
    };

    void fetchInitialData().catch(() => undefined);

    return () => {
      cancelled = true;
      const store = useWatchPartyStore.getState();
      store.setWantsVoiceConnected(false);
      store.setIsVoiceConnected(false);
    };
  }, [roomId, supabase]);

  const getMyParticipant = useCallback(() => {
    const state = useWatchPartyStore.getState();
    return (
      state.participants.find((participant) => participant.user_id === user.id) ||
      (participantsLoadedRef.current ? null : initialMe)
    );
  }, [initialMe, user.id]);

  const getIsHost = useCallback(() => {
    const me = getMyParticipant();
    return me?.status === "approved" && me.role === "host";
  }, [getMyParticipant]);

  const getCanControl = useCallback(() => {
    const state = useWatchPartyStore.getState();
    const me = getMyParticipant();
    if (!me || me.status !== "approved") return false;

    return (
      me.role === "host" ||
      !!me.permissions?.can_control_media ||
      !!state.room?.settings?.allow_guest_control
    );
  }, [getMyParticipant]);

  const {
    sendControl,
    sendHeartbeat,
    applyInitialState,
    requestControllerSync,
    isLoadingRoom,
    initialState,
    activeControllerId,
    activeControllerName,
  } = usePlaybackRealtime(
      roomId,
      user.id,
      getCanControl,
      getIsHost,
      supabase,
      (action, time) => playerSyncRef.current?.syncFromRemote(action, time),
      (slug) =>
        useWatchPartyStore
          .getState()
          .updateRoom({ current_episode_slug: slug }),
      () => playerSyncRef.current?.getCurrentState?.() ?? null,
      (time, isPaused) => playerSyncRef.current?.syncHeartbeat(time, isPaused),
    );

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    (window as typeof window & { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__ = () => {
      const state = useWatchPartyStore.getState();
      return {
        userId: state.user?.id,
        myParticipantId: state.myParticipantId,
        dataChannelState: state.dataChannel?.state,
        dataChannelStatus: state.dataChannelStatus,
        myParticipant: selectMyParticipant(state),
        canControl: selectCanControl(state),
        presenceData: state.presenceData,
        participants: state.participants.map((participant) => ({
          id: participant.id,
          user_id: participant.user_id,
          status: participant.status,
          role: participant.role,
          display_name: participant.display_name,
          profile_name: participant.profiles?.full_name,
          permissions: participant.permissions,
          is_muted: participant.is_muted,
          realtime_revision: participant.realtime_revision,
        })),
      };
    };

    return () => {
      delete (window as typeof window & { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__;
    };
  }, []);

  const playback = useMemo<WatchPartyPlayback>(
    () => ({
      playerSyncRef,
      sendCommand: sendControl,
      sendHeartbeat,
      applyInitialState,
      requestControllerSync,
      activeControllerId,
      activeControllerName,
      initialState,
      isLoadingRoom,
    }),
    [
      activeControllerId,
      activeControllerName,
      applyInitialState,
      initialState,
      isLoadingRoom,
      requestControllerSync,
      sendControl,
      sendHeartbeat,
    ],
  );

  const contextValue = useMemo<WatchPartyContextType>(
    () => ({
      playerSyncRef: playback.playerSyncRef,
      sendControl: playback.sendCommand,
      sendHeartbeat: playback.sendHeartbeat,
      applyInitialState: playback.applyInitialState,
      requestControllerSync: playback.requestControllerSync,
      isLoadingRoom: playback.isLoadingRoom,
      initialState: playback.initialState,
      activeControllerId: playback.activeControllerId,
      activeControllerName: playback.activeControllerName,
    }),
    [playback],
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



