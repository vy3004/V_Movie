"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { SyncApiPayload } from "@/types";
import {
  canAcceptRequestedSystemSync,
  canApplyHeartbeat,
  canApplyPlaybackState,
  canTrustUserPlaybackPayload,
  CanonicalPlaybackState,
  HeartbeatPayload,
  InitialPlaybackState,
  PlaybackAction,
  PlaybackStatePayload,
  PlaybackSyncRequestPayload,
  PlayerState,
  PENDING_LOCAL_CONTROL_FALLBACK_MS,
  shouldIgnoreNonUserPlaybackPayload,
  shouldSuppressRemoteWhilePendingLocal,
  toPlaybackStatePayload,
} from "@/features/watch-party/playback-sync";

export function usePlaybackRealtime(
  roomId: string | null,
  userId: string | undefined,
  getCanControl: () => boolean,
  getIsHost: () => boolean,
  supabase: SupabaseClient,
  syncFromRemote: (action: PlaybackAction, time: number, slug?: string) => void,
  onChangeEpisode?: (slug: string) => void,
  getCurrentState?: () => PlayerState | null,
  syncHeartbeat?: (time: number, isPaused: boolean) => void,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerStateRef = useRef<PlayerState | null>(null);
  const initialStateRef = useRef<InitialPlaybackState | null>(null);
  const hasAppliedInitialStateRef = useRef(false);
  const lastAppliedVersionRef = useRef(0);
  const pendingSyncRequestIdRef = useRef<string | null>(null);
  const pendingLocalControlRequestIdRef = useRef<string | null>(null);
  const pendingLocalControlUntilRef = useRef(0);
  const activeControllerIdRef = useRef<string | undefined>(undefined);
  const activeControllerNameRef = useRef<string | undefined>(undefined);
  const localControlUntilRef = useRef(0);
  const [activeController, setActiveController] = useState<{
    id?: string;
    name?: string;
  }>({});
  const refs = useRef({
    getCanControl,
    getIsHost,
    syncFromRemote,
    onChangeEpisode,
    getCurrentState,
    syncHeartbeat,
  });

  useEffect(() => {
    refs.current = {
      getCanControl,
      getIsHost,
      syncFromRemote,
      onChangeEpisode,
      getCurrentState,
      syncHeartbeat,
    };
  });

  const updateActiveController = useCallback((id?: string, name?: string) => {
    activeControllerIdRef.current = id;
    activeControllerNameRef.current = name;
    setActiveController((current) => {
      if (current.id === id && current.name === name) return current;
      return { id, name };
    });
  }, []);

  const { data: initialData, isLoading: isLoadingRoom } = useQuery({
    queryKey: ["watch-party", roomId],
    queryFn: async () => {
      if (!roomId) return null;
      const res = await fetch(
        `/api/watch-party?roomId=${encodeURIComponent(roomId)}`,
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch room: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!roomId,
    refetchOnWindowFocus: false,
  });

  const broadcastState = useCallback((payload: PlaybackStatePayload) => {
    if (channelRef.current?.state !== "joined") return;
    channelRef.current
      .send({
        type: "broadcast",
        event: "video_control",
        payload,
      })
      .catch((err: Error) => {
        console.error("Lá»—i gá»­i Broadcast:", err);
      });
  }, []);

  const applyInitialState = useCallback(() => {
    const initialState = initialStateRef.current;
    if (!initialState || hasAppliedInitialStateRef.current) return;

    const time =
      initialState.status === "play"
        ? initialState.time + (Date.now() - initialState.calculatedAt) / 1000
        : initialState.time;
    const action = initialState.isPaused ? "pause" : "play";

    hasAppliedInitialStateRef.current = true;
    playerStateRef.current = { time, isPaused: initialState.isPaused };
    refs.current.syncFromRemote(action, time);
  }, []);

  useEffect(() => {
    const state = initialData?.state as CanonicalPlaybackState | undefined;
    hasAppliedInitialStateRef.current = false;

    if (!state) {
      initialStateRef.current = null;
      return;
    }

    const status = state.status ?? "pause";
    initialStateRef.current = {
      time: state.time,
      isPaused: status === "pause",
      status,
      calculatedAt: state.calculated_at ?? Date.now(),
    };
    lastAppliedVersionRef.current = Math.max(
      lastAppliedVersionRef.current,
      state.version ?? 0,
    );
    updateActiveController(state.active_controller_id, state.active_controller_name);

    if (refs.current.getCurrentState?.()) {
      applyInitialState();
    }
  }, [applyInitialState, initialData?.state, updateActiveController]);

  useEffect(() => {
    if (!roomId || !userId) return;

    const channel = supabase.channel(`wp_video_${roomId}`, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });

    channel
      .on("broadcast", { event: "video_control" }, ({ payload }) => {
        const statePayload = payload as PlaybackStatePayload;
        if (statePayload.senderId === userId) return;

        const isRequestedSystemSync = canAcceptRequestedSystemSync({
          payloadOrigin: statePayload.origin,
          payloadRequestId: statePayload.requestId,
          pendingRequestId: pendingSyncRequestIdRef.current,
          currentActiveControllerId: activeControllerIdRef.current,
          payloadActiveControllerId: statePayload.activeControllerId,
        });

        if (
          statePayload.origin === "system" &&
          statePayload.requestId === pendingSyncRequestIdRef.current &&
          !isRequestedSystemSync
        ) {
          pendingSyncRequestIdRef.current = null;
          return;
        }

        if (shouldIgnoreNonUserPlaybackPayload({
          origin: statePayload.origin,
          isRequestedSystemSync,
        })) {
          return;
        }
        if (
          statePayload.origin === "user" &&
          !canTrustUserPlaybackPayload({
            origin: statePayload.origin,
            senderId: statePayload.senderId,
            activeControllerId: statePayload.activeControllerId,
          })
        ) {
          return;
        }
        if (!canApplyPlaybackState({
          incomingVersion: statePayload.version,
          lastAppliedVersion: lastAppliedVersionRef.current,
        })) return;
        const hasPendingLocalControl = shouldSuppressRemoteWhilePendingLocal({
          pendingRequestId: pendingLocalControlRequestIdRef.current,
          pendingUntil: pendingLocalControlUntilRef.current,
          now: Date.now(),
        });

        lastAppliedVersionRef.current = statePayload.version;
        updateActiveController(
          statePayload.activeControllerId,
          statePayload.activeControllerName,
        );

        if (statePayload.episodeSlug && refs.current.onChangeEpisode) {
          refs.current.onChangeEpisode(statePayload.episodeSlug);
        }

        const action = statePayload.action ?? statePayload.status;
        if (!hasPendingLocalControl) {
          refs.current.syncFromRemote(action, statePayload.time);
          playerStateRef.current = {
            time: statePayload.time,
            isPaused: statePayload.status === "pause",
          };
        }

        if (isRequestedSystemSync) {
          pendingSyncRequestIdRef.current = null;
        }
      })
      .on("broadcast", { event: "heartbeat_sync" }, ({ payload }) => {
        const heartbeat = payload as HeartbeatPayload;
        if (!canApplyHeartbeat({
          senderId: heartbeat.senderId,
          localUserId: userId,
          heartbeatVersion: heartbeat.version,
          lastAppliedVersion: lastAppliedVersionRef.current,
          heartbeatControllerId: heartbeat.controllerId,
          activeControllerId: activeControllerIdRef.current,
          localControlUntil: localControlUntilRef.current,
          now: Date.now(),
          currentPlayerState: playerStateRef.current,
          heartbeatTime: heartbeat.time,
        })) return;

        refs.current.syncHeartbeat?.(heartbeat.time, heartbeat.isPaused);
        playerStateRef.current = {
          time: heartbeat.time,
          isPaused: heartbeat.isPaused,
        };
      })
      .on("broadcast", { event: "request_sync_from_host" }, ({ payload }) => {
        const request = payload as PlaybackSyncRequestPayload;
        if (!refs.current.getCanControl()) return;
        if (activeControllerIdRef.current !== userId) return;

        const state = refs.current.getCurrentState?.() ?? playerStateRef.current;
        if (!state) return;

        broadcastState({
          status: state.isPaused ? "pause" : "play",
          action: state.isPaused ? "pause" : "play",
          time: state.time,
          activeControllerId: activeControllerIdRef.current,
          activeControllerName: activeControllerNameRef.current,
          version: lastAppliedVersionRef.current,
          updatedAt: Date.now(),
          senderId: userId,
          requestId: request.requestId,
          origin: "system",
        });
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;

        const requestId = `${userId}-${Date.now()}`;
        pendingSyncRequestIdRef.current = requestId;
        channel
          .send({
            type: "broadcast",
            event: "request_sync_from_host",
            payload: { senderId: userId, requestId },
          })
          .catch(() => {});
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [broadcastState, roomId, supabase, updateActiveController, userId]);

  const sendControl = useCallback(
    (action: PlaybackAction, time: number, episodeSlug?: string) => {
      if (!roomId || !channelRef.current) return;
      if (!refs.current.getCanControl()) return;

      const currentState = refs.current.getCurrentState?.() ?? playerStateRef.current;
      const isPaused =
        action === "pause"
          ? true
          : action === "play"
            ? false
            : (currentState?.isPaused ?? playerStateRef.current?.isPaused ?? false);

      const requestId = `${userId ?? "anonymous"}-${Date.now()}`;
      playerStateRef.current = { time, isPaused };
      localControlUntilRef.current = Date.now() + PENDING_LOCAL_CONTROL_FALLBACK_MS;
      pendingLocalControlRequestIdRef.current = requestId;
      pendingLocalControlUntilRef.current = Date.now() + PENDING_LOCAL_CONTROL_FALLBACK_MS;

      const status: "play" | "pause" = isPaused ? "pause" : "play";
      const syncPayload: SyncApiPayload = {
        roomId,
        status,
        time,
        episodeSlug,
        requestId,
      };

      void fetch("/api/watch-party/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syncPayload),
        keepalive: true,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("Sync rejected");
          return res.json();
        })
        .then((result) => {
          if (!result?.state) {
            if (pendingLocalControlRequestIdRef.current === requestId) {
              playerStateRef.current = currentState;
              pendingLocalControlRequestIdRef.current = null;
              pendingLocalControlUntilRef.current = 0;
              localControlUntilRef.current = 0;
            }
            return;
          }
          const acceptedRequestId = result.requestId ?? requestId;
          const accepted = toPlaybackStatePayload(
            result.state,
            userId,
            action,
            acceptedRequestId,
          );
          if (acceptedRequestId === pendingLocalControlRequestIdRef.current) {
            pendingLocalControlRequestIdRef.current = null;
            pendingLocalControlUntilRef.current = 0;
            localControlUntilRef.current = 0;
          }
          if (!canApplyPlaybackState({
            incomingVersion: accepted.version,
            lastAppliedVersion: lastAppliedVersionRef.current,
          })) return;
          lastAppliedVersionRef.current = accepted.version;
          updateActiveController(
            accepted.activeControllerId,
            accepted.activeControllerName,
          );
          broadcastState(accepted);
        })
        .catch(() => {
          if (pendingLocalControlRequestIdRef.current === requestId) {
            playerStateRef.current = currentState;
            pendingLocalControlRequestIdRef.current = null;
            pendingLocalControlUntilRef.current = 0;
            localControlUntilRef.current = 0;
          }
        });
    },
    [broadcastState, roomId, updateActiveController, userId],
  );

  const sendHeartbeat = useCallback(
    (time: number, isPaused: boolean) => {
      if (!roomId || !channelRef.current) return;
      if (!refs.current.getCanControl()) return;
      if (activeControllerIdRef.current !== userId) return;

      playerStateRef.current = { time, isPaused };

      if (channelRef.current.state === "joined") {
        channelRef.current
          .send({
            type: "broadcast",
            event: "heartbeat_sync",
            payload: {
              time,
              senderId: userId,
              controllerId: activeControllerIdRef.current,
              version: lastAppliedVersionRef.current,
              status: isPaused ? "pause" : "play",
              isPaused,
            },
          })
          .catch(() => {});
      }
    },
    [roomId, userId],
  );

  return {
    sendControl,
    sendHeartbeat,
    applyInitialState,
    activeControllerId: activeController.id,
    activeControllerName: activeController.name,
    roomData: initialData?.room,
    initialState: initialData?.state
      ? {
          time: initialData.state.time,
          isPaused: (initialData.state.status ?? "pause") === "pause",
          status: initialData.state.status ?? "pause",
          calculatedAt: initialData.state.calculated_at ?? Date.now(),
        }
      : null,
    isLoadingRoom,
  };
}

