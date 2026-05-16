"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import {
  PlayerSyncRef,
  UserProfile,
  WatchPartyRoom,
  WatchPartyParticipant,
} from "@/types";
import {
  usePlaybackRealtime,
  WatchPartyPlayback,
} from "@/features/watch-party/playback-sync";
import { useWatchPartyStore } from "@/stores/watch-party";

interface WatchPartyContextType {
  playerSyncRef: React.MutableRefObject<PlayerSyncRef | null>;
  sendControl: (
    action: "play" | "pause" | "seek",
    time: number,
    slug?: string,
  ) => void;
  sendHeartbeat: (time: number, isPaused: boolean) => void;
  applyInitialState: () => void;
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

  const hydrated = useRef(false);
  if (!hydrated.current) {
    const store = useWatchPartyStore.getState();
    store.setRoom(initialRoom);
    store.setUser(user);
    store.setMyParticipantId(initialMe.id);
    hydrated.current = true;
  }

  useEffect(() => {
    const fetchInitialParticipants = async () => {
      const { data, error } = await supabase
        .from("watch_party_participants")
        .select(`*, profiles:user_id(full_name, avatar_url)`)
        .eq("room_id", roomId);

      if (!error && data) {
        useWatchPartyStore
          .getState()
          .setParticipants(data as WatchPartyParticipant[]);
      }
    };

    fetchInitialParticipants();
  }, [roomId, supabase]);

  const getMyParticipant = useCallback(() => {
    const state = useWatchPartyStore.getState();
    return (
      state.participants.find((participant) => participant.user_id === user.id) ||
      initialMe
    );
  }, [initialMe, user.id]);

  const getIsHost = useCallback(() => {
    return getMyParticipant().role === "host";
  }, [getMyParticipant]);

  const getCanControl = useCallback(() => {
    const state = useWatchPartyStore.getState();
    const me = getMyParticipant();

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

  const playback = useMemo<WatchPartyPlayback>(
    () => ({
      playerSyncRef,
      sendCommand: sendControl,
      sendHeartbeat,
      applyInitialState,
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
