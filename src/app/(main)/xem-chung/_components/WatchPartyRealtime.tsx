"use client";

import { useEffect, useRef } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useWatchPartyStore } from "@/stores/watch-party";
import { startPresenceWorker } from "@/stores/watch-party/workers/presence.worker";
import { isEqual } from "lodash-es";
import {
  WatchPartyRoom,
  WatchPartyParticipant,
  ChatMessage,
  UserPresence,
  PlaylistItem,
} from "@/types";

interface WatchPartyRealtimeProps {
  roomId: string;
  userId: string;
}

// Grace Period:
// - Guest: 30s (đủ cho F5 reconnect và browser lag khi spam chat)
// - Host: 45s (tránh host succession không cần thiết)
const GUEST_GRACE_PERIOD_MS = 30000;
const HOST_GRACE_PERIOD_MS = 45000;

/**
 * Headless component that manages 2 independent Realtime channels:
 * 1. wp_data_${roomId} - Data & Presence (low-medium frequency)
 * 2. wp_media_${roomId} - Media Sync (high frequency, no presence)
 */
export default function WatchPartyRealtime({
  roomId,
  userId,
}: WatchPartyRealtimeProps) {
  const dataChannelRef = useRef<RealtimeChannel | null>(null);
  const mediaChannelRef = useRef<RealtimeChannel | null>(null);
  const pendingKicksRef = useRef<Record<string, NodeJS.Timeout>>({});
  const supabase = createSupabaseClient();

  // Extract specific setter functions to avoid infinite loop
  const updateRoom = useWatchPartyStore((state) => state.updateRoom);
  const updatePlayerState = useWatchPartyStore(
    (state) => state.updatePlayerState,
  );
  const addParticipant = useWatchPartyStore((state) => state.addParticipant);
  const updateParticipant = useWatchPartyStore(
    (state) => state.updateParticipant,
  );
  const removeParticipant = useWatchPartyStore(
    (state) => state.removeParticipant,
  );
  const addPlaylistItem = useWatchPartyStore((state) => state.addPlaylistItem);
  const updatePlaylistItem = useWatchPartyStore(
    (state) => state.updatePlaylistItem,
  );
  const removePlaylistItem = useWatchPartyStore(
    (state) => state.removePlaylistItem,
  );
  const addMessage = useWatchPartyStore((state) => state.addMessage);
  const setPresence = useWatchPartyStore((state) => state.setPresence);
  const removePresence = useWatchPartyStore((state) => state.removePresence);
  const setAllPresence = useWatchPartyStore((state) => state.setAllPresence);
  const setMediaChannel = useWatchPartyStore((state) => state.setMediaChannel);
  const syncFromRemote = useWatchPartyStore((state) => state.syncFromRemote);

  useEffect(() => {
    // ---------------------------------------------------------
    // SAVE STATE BEFORE UNLOAD (F5 / Close Tab)
    // ---------------------------------------------------------
    const handleBeforeUnload = () => {
      const state = useWatchPartyStore.getState();
      const isHost =
        state.participants.find((p) => p.user_id === userId)?.role === "host";

      // Only host saves state before unload
      if (isHost && state.playerSyncRef) {
        const playerState = state.playerSyncRef.getCurrentState?.();
        if (playerState) {
          // Use sendBeacon for reliable delivery during page unload
          const payload = {
            roomId,
            status: playerState.isPaused ? "pause" : "play",
            time: playerState.time,
            episodeSlug: state.room?.current_episode_slug,
          };

          navigator.sendBeacon(
            "/api/watch-party/sync",
            new Blob([JSON.stringify(payload)], { type: "application/json" }),
          );

          console.log(
            "[WatchPartyRealtime] Saved state before unload:",
            payload,
          );
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // ---------------------------------------------------------
    // START PRESENCE WORKER (Ghost Cleanup + Host Succession)
    // ---------------------------------------------------------
    const stopWorker = startPresenceWorker(supabase, roomId);

    // ---------------------------------------------------------
    // CHANNEL 1: DATA & PRESENCE (wp_data_${roomId})
    // ---------------------------------------------------------
    const dataChannel = supabase.channel(`wp_data_${roomId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    // 1. Subscribe to room updates
    dataChannel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "watch_party_rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        const updatedRoom = payload.new as WatchPartyRoom;
        const oldRoom = payload.old as WatchPartyRoom;

        // Check if episode changed
        if (updatedRoom.current_episode_slug !== oldRoom.current_episode_slug) {
          // Reset player state when episode changes
          updatePlayerState(0, true);
        }

        updateRoom(updatedRoom);
      },
    );

    // 2. Subscribe to participant changes
    dataChannel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "watch_party_participants",
        filter: `room_id=eq.${roomId}`,
      },
      async (payload) => {
        const newParticipant = payload.new as WatchPartyParticipant;

        // ⚡ OPTIMISTIC UPDATE: Add placeholder immediately for instant UI feedback
        addParticipant({
          ...newParticipant,
          profiles: { full_name: "Đang kết nối...", avatar_url: "" },
        } as WatchPartyParticipant);

        // ⚡ TARGETED FETCH: Only fetch profile data (not entire participant list)
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", newParticipant.user_id)
            .single();

          if (!error && data) {
            // Update only this participant with profile data
            updateParticipant(newParticipant.id, {
              profiles: data,
            } as Partial<WatchPartyParticipant>);
          }
        } catch (err) {
          console.error("[WatchPartyRealtime] Failed to fetch profile:", err);
        }
      },
    );

    dataChannel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "watch_party_participants",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        console.log("[WatchPartyRealtime] Participant updated:", payload.new);
        const updatedParticipant = payload.new as WatchPartyParticipant;
        updateParticipant(updatedParticipant.id, updatedParticipant);
      },
    );

    dataChannel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "watch_party_participants",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const deletedParticipant = payload.old as WatchPartyParticipant;
        console.log("[WatchPartyRealtime] Participant deleted:", {
          deletedId: deletedParticipant.id,
          deletedUserId: deletedParticipant.user_id,
        });
        removeParticipant(deletedParticipant.id);

        // Check if the deleted participant is myself - if so, I've been kicked
        const state = useWatchPartyStore.getState();
        console.log("[WatchPartyRealtime] Checking if kicked:", {
          myParticipantId: state.myParticipantId,
          deletedId: deletedParticipant.id,
          isMe: deletedParticipant.id === state.myParticipantId,
        });
        if (deletedParticipant.id === state.myParticipantId) {
          console.log("[WatchPartyRealtime] I've been kicked!");
          state.setIsKicked(true); // Trigger kick modal and redirect to lobby
        }
      },
    );

    // 3. Subscribe to playlist changes
    dataChannel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "watch_party_playlist",
        filter: `room_id=eq.${roomId}`,
      },
      async (payload) => {
        const newItem = payload.new as PlaylistItem;

        // Add placeholder first
        addPlaylistItem({
          ...newItem,
          profiles: { full_name: "Đang tải...", avatar_url: "" },
        } as PlaylistItem);

        // Fetch full data with profiles
        try {
          const { data, error } = await supabase
            .from("watch_party_playlist")
            .select(`*, profiles:added_by(full_name, avatar_url)`)
            .eq("id", newItem.id)
            .single();

          if (!error && data) {
            updatePlaylistItem(newItem.id, data as PlaylistItem);
          }
        } catch (err) {
          console.error(
            "[WatchPartyRealtime] Failed to fetch playlist item:",
            err,
          );
        }
      },
    );

    dataChannel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "watch_party_playlist",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const updatedItem = payload.new as PlaylistItem;
        updatePlaylistItem(updatedItem.id, updatedItem);
      },
    );

    dataChannel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "watch_party_playlist",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const deletedItem = payload.old as PlaylistItem;
        removePlaylistItem(deletedItem.id);
      },
    );

    // 4. Subscribe to chat messages
    dataChannel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "watch_party_messages",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        console.log("[WatchPartyRealtime] Received new message:", payload.new);
        const newMessage = payload.new as ChatMessage;
        addMessage(newMessage);
      },
    );

    // 4b. Subscribe to system messages (broadcast only, not saved to DB)
    dataChannel.on("broadcast", { event: "system_message" }, ({ payload }) => {
      console.log("[WatchPartyRealtime] Received system message:", payload);
      const systemMessage = payload as ChatMessage;
      addMessage(systemMessage);
    });

    // 5. Room events
    dataChannel.on(
      "broadcast",
      { event: "change_episode_sync" },
      ({ payload }) => {
        updateRoom({ current_episode_slug: payload.slug });
        if (payload.movie_slug) {
          updateRoom({
            current_movie_slug: payload.movie_slug,
            movie_image: payload.movie_image,
          });
        }
      },
    );

    // 7. Handle leave requests (when guest manually leaves)
    dataChannel.on(
      "broadcast",
      { event: "request_leave" },
      async ({ payload }) => {
        const { userId: leavingUserId } = payload;

        // Only host processes leave requests
        const currentParticipants = useWatchPartyStore.getState().participants;
        const isHost =
          currentParticipants.find((p) => p.user_id === userId)?.role ===
          "host";
        if (!isHost || !leavingUserId) return;

        console.log(
          "[WatchPartyRealtime] Host received request_leave from:",
          leavingUserId,
        );

        // Kick the user who requested to leave
        try {
          const response = await fetch("/api/watch-party/participant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId: roomId,
              targetUserId: leavingUserId,
              action: "kick",
            }),
          });

          if (!response.ok) {
            console.error(
              "[WatchPartyRealtime] Failed to process leave request:",
              response.status,
            );
          }
        } catch (error) {
          console.error(
            "[WatchPartyRealtime] Error processing leave request:",
            error,
          );
        }
      },
    );

    // 8. Subscribe to presence (ONLY on data channel)
    dataChannel.on("presence", { event: "sync" }, () => {
      const state = dataChannel.presenceState();

      // Convert presence state to Record format
      const presenceData: Record<string, UserPresence> = {};
      Object.keys(state).forEach((key) => {
        const presences = state[key];
        if (presences && presences.length > 0) {
          const presence = presences[0] as unknown as UserPresence;
          presenceData[presence.user_id] = presence;
        }
      });

      // Chỉ update store nếu presence data thực sự thay đổi (tránh re-render vô ích)
      const currentPresence = useWatchPartyStore.getState().presenceData;
      if (!isEqual(currentPresence, presenceData)) {
        setAllPresence(presenceData);
      }
    });

    dataChannel.on("presence", { event: "join" }, ({ newPresences }) => {
      newPresences.forEach((presence) => {
        const userPresence = presence as unknown as UserPresence;
        setPresence(userPresence.user_id, userPresence);

        // If user rejoins (F5 reconnect), cancel the 15s countdown
        if (pendingKicksRef.current[userPresence.user_id]) {
          clearTimeout(pendingKicksRef.current[userPresence.user_id]);
          delete pendingKicksRef.current[userPresence.user_id];
          console.log(
            "[Grace Period] User reconnected, cancelled kick countdown:",
            userPresence.user_id,
          );
        }
      });
    });

    dataChannel.on("presence", { event: "leave" }, ({ leftPresences }) => {
      leftPresences.forEach((presence) => {
        const userPresence = presence as unknown as UserPresence;

        // Only remove if they're truly offline (not in presenceState at all)
        const currentPresenceState = dataChannel.presenceState();
        const stillPresent = Object.values(currentPresenceState).some(
          (presences) =>
            presences.some((p: unknown) => {
              const pr = p as UserPresence;
              return pr.user_id === userPresence.user_id;
            }),
        );

        // If user is still in presence (status: away), don't remove them or start kick timer
        if (stillPresent) {
          console.log(
            "[WatchPartyRealtime] User switched to away, NOT starting kick timer:",
            userPresence.user_id,
          );
          return;
        }

        // User is truly offline (not in presenceState)
        removePresence(userPresence.user_id);

        // Only host kicks offline users
        const currentParticipants = useWatchPartyStore.getState().participants;
        const isHost =
          currentParticipants.find((p) => p.user_id === userId)?.role ===
          "host";
        if (!isHost || userPresence.user_id === userId) return;

        // Check if the offline user is a host (needs longer grace period)
        const offlineUserParticipant = currentParticipants.find(
          (p) => p.user_id === userPresence.user_id,
        );
        const isOfflineUserHost = offlineUserParticipant?.role === "host";
        const gracePeriod = isOfflineUserHost
          ? HOST_GRACE_PERIOD_MS
          : GUEST_GRACE_PERIOD_MS;

        console.log(
          `[Grace Period] User truly offline, starting ${gracePeriod / 1000}s grace period (${isOfflineUserHost ? "HOST" : "GUEST"}):`,
          userPresence.user_id,
        );

        // Grace Period: Wait before kicking (15s for guest, 30s for host)
        pendingKicksRef.current[userPresence.user_id] = setTimeout(async () => {
          // AFTER GRACE PERIOD: Final check if user reconnected
          const latestState = useWatchPartyStore.getState();
          const isStillOffline =
            !latestState.presenceData[userPresence.user_id];

          if (!isStillOffline) {
            console.log(
              "[Grace Period] User reconnected (F5 success), cancelling kick:",
              userPresence.user_id,
            );
            delete pendingKicksRef.current[userPresence.user_id];
            return;
          }

          console.log(
            `[Grace Period] ${gracePeriod / 1000}s expired, user still offline, kicking:`,
            userPresence.user_id,
          );

          try {
            const response = await fetch("/api/watch-party/participant", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                roomId: roomId,
                targetUserId: userPresence.user_id,
                action: "kick",
              }),
            });

            if (!response.ok) {
              console.error(
                "[WatchPartyRealtime] Failed to kick offline user:",
                response.status,
              );
            }
          } catch (error) {
            console.error(
              "[WatchPartyRealtime] Error kicking offline user:",
              error,
            );
          } finally {
            delete pendingKicksRef.current[userPresence.user_id];
          }
        }, gracePeriod);
      });
    });

    // ---------------------------------------------------------
    // CHANNEL 2: MEDIA SYNC (wp_media_${roomId})
    // High frequency, no presence tracking
    // ---------------------------------------------------------
    const mediaChannel = supabase.channel(`wp_media_${roomId}`, {
      config: {
        broadcast: { ack: false, self: false },
        // Note: Omit presence config to disable presence tracking
      },
    });

    // Biến cục bộ để chặn gói tin "đến muộn" (Out-of-order packets)
    let lastProcessedTimestamp = 0;

    // 1. Video control events
    mediaChannel.on("broadcast", { event: "video_control" }, ({ payload }) => {
      const { action, time, episodeSlug, senderId, sentAt } = payload;

      console.log("[WatchPartyRealtime] Received video_control:", {
        action,
        time,
        episodeSlug,
        senderId,
        sentAt,
        myUserId: userId,
      });

      // Only sync if not from self
      if (senderId !== userId) {
        // Chặn các gói tin "đến muộn" (Out of order)
        if (sentAt && sentAt < lastProcessedTimestamp) {
          console.log(
            "[WatchPartyRealtime] Bỏ qua gói tin cũ (out-of-order):",
            {
              sentAt,
              lastProcessedTimestamp,
            },
          );
          return;
        }
        if (sentAt) lastProcessedTimestamp = sentAt;

        if (episodeSlug) {
          updateRoom({ current_episode_slug: episodeSlug });
        }
        console.log("[WatchPartyRealtime] Calling syncFromRemote:", {
          action,
          time,
        });
        syncFromRemote(action, time);
      } else {
        console.log("[WatchPartyRealtime] Ignoring own broadcast");
      }
    });

    // 2. Heartbeat sync for soft sync
    mediaChannel.on("broadcast", { event: "heartbeat_sync" }, ({ payload }) => {
      const { time, isPaused, senderId, sentAt } = payload;

      // Only sync if not from self and user cannot control
      const currentParticipants = useWatchPartyStore.getState().participants;
      const me = currentParticipants.find((p) => p.user_id === userId);
      const canControl =
        me?.permissions?.can_control_media || me?.role === "host";

      if (senderId !== userId && !canControl) {
        // Chặn heartbeat cũ (out-of-order)
        if (sentAt && sentAt < lastProcessedTimestamp) {
          console.log(
            "[WatchPartyRealtime] Bỏ qua heartbeat cũ (out-of-order)",
          );
          return;
        }
        if (sentAt) lastProcessedTimestamp = sentAt;

        syncFromRemote(isPaused ? "pause" : "play", time);
      }
    });

    // 3. Handle sync request from guests (only host responds)
    mediaChannel.on("broadcast", { event: "request_sync_from_host" }, () => {
      const state = useWatchPartyStore.getState();
      const isHost =
        state.participants.find((p) => p.user_id === state.user?.id)?.role ===
        "host";

      if (isHost && state.playerSyncRef) {
        const playerState = state.playerSyncRef.getCurrentState?.();
        if (playerState) {
          mediaChannel
            .send({
              type: "broadcast",
              event: "room_sync_response",
              payload: {
                action: playerState.isPaused ? "pause" : "play",
                time: playerState.time,
              },
            })
            .catch(() => {});
        }
      }
    });

    // 4. Receive sync response from host (guests only)
    mediaChannel.on(
      "broadcast",
      { event: "room_sync_response" },
      ({ payload }) => {
        const state = useWatchPartyStore.getState();
        const isHost =
          state.participants.find((p) => p.user_id === state.user?.id)?.role ===
          "host";

        if (!isHost && state.playerSyncRef) {
          state.playerSyncRef.syncFromRemote(payload.action, payload.time);
        }
      },
    );

    // Subscribe to data channel
    dataChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        console.log("[WatchPartyRealtime] Data channel connected:", roomId);

        // Track presence immediately after subscription
        await dataChannel.track({
          user_id: userId,
          status: "online",
          online_at: new Date().toISOString(),
        });
      }
    });

    // Subscribe to media channel
    mediaChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[WatchPartyRealtime] Media channel connected:", roomId);

        // Save media channel ref to store AFTER it's subscribed
        setMediaChannel(mediaChannel);

        // Guest requests initial sync from host
        const state = useWatchPartyStore.getState();
        const isHost =
          state.participants.find((p) => p.user_id === state.user?.id)?.role ===
          "host";

        if (!isHost) {
          let syncReceived = false;

          // Listen for sync response BEFORE requesting
          mediaChannel.on(
            "broadcast",
            { event: "room_sync_response" },
            ({ payload }) => {
              if (syncReceived) return;
              syncReceived = true;
              console.log(
                "[WatchPartyRealtime] Received initial sync from host:",
                payload,
              );

              // Wait for playerSyncRef to be ready
              const waitForPlayer = setInterval(() => {
                const state = useWatchPartyStore.getState();
                if (state.playerSyncRef?.syncFromRemote) {
                  clearInterval(waitForPlayer);
                  state.playerSyncRef.syncFromRemote(
                    payload.action,
                    payload.time,
                  );
                }
              }, 100);

              // Timeout after 5 seconds
              setTimeout(() => clearInterval(waitForPlayer), 5000);
            },
          );

          const requestSync = async () => {
            if (mediaChannel.state !== "joined" || syncReceived) return;
            try {
              await mediaChannel.send({
                type: "broadcast",
                event: "request_sync_from_host",
                payload: {},
              });
            } catch (error) {
              console.error(
                "[WatchPartyRealtime] Failed to request sync:",
                error,
              );
            }
          };

          // Request immediately, then retry if no response
          requestSync(); // Immediate request (0ms)
          setTimeout(requestSync, 1500); // Retry after 1.5s
          setTimeout(requestSync, 3500); // Retry after 3.5s

          // Fallback: If host doesn't respond, fetch from API (reduced from 8s to 5s)
          setTimeout(async () => {
            if (mediaChannel.state !== "joined" || syncReceived) return;
            try {
              console.log(
                "[WatchPartyRealtime] Host not responding, fetching state from API...",
              );
              const res = await fetch(`/api/watch-party?roomId=${roomId}`);
              if (res.ok) {
                const data = await res.json();
                if (data.state && data.state.time !== undefined) {
                  syncReceived = true;
                  const action =
                    data.state.status === "pause" ? "pause" : "play";

                  console.log(
                    "[WatchPartyRealtime] Received fallback sync from API:",
                    data.state,
                  );

                  // Wait for playerSyncRef to be ready
                  const waitForPlayer = setInterval(() => {
                    const state = useWatchPartyStore.getState();
                    if (state.playerSyncRef?.syncFromRemote) {
                      clearInterval(waitForPlayer);
                      state.playerSyncRef.syncFromRemote(
                        action,
                        data.state.time,
                      );
                    }
                  }, 100);

                  // Timeout after 5 seconds
                  setTimeout(() => clearInterval(waitForPlayer), 5000);
                }
              }
            } catch (error) {
              console.error(
                "[WatchPartyRealtime] Failed to fetch fallback sync:",
                error,
              );
            }
          }, 5000); // Changed from 8000ms to 5000ms
        }
      }
    });

    dataChannelRef.current = dataChannel;
    mediaChannelRef.current = mediaChannel;

    // Handle visibility change for "away" status (ONLY on data channel)
    const handleVisibilityChange = () => {
      console.log("[WatchPartyRealtime] Visibility changed:", {
        visibilityState: document.visibilityState,
        hasDataChannel: !!dataChannelRef.current,
        channelState: dataChannelRef.current?.state,
      });

      if (!dataChannelRef.current) {
        console.warn(
          "[WatchPartyRealtime] Data channel not available for visibility change",
        );
        return;
      }

      if (document.visibilityState === "hidden") {
        // Tab hidden → set "away"
        console.log("[WatchPartyRealtime] Setting status to away");
        dataChannelRef.current
          .track({
            user_id: userId,
            status: "away",
            updated_at: new Date().toISOString(),
          })
          .catch((err) => {
            console.error(
              "[WatchPartyRealtime] Failed to track away status:",
              err,
            );
          });
      } else {
        // Tab visible → set "online" AND re-track presence to prevent kick
        console.log("[WatchPartyRealtime] Setting status to online");
        dataChannelRef.current
          .track({
            user_id: userId,
            status: "online",
            online_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .catch((err) => {
            console.error(
              "[WatchPartyRealtime] Failed to track online status:",
              err,
            );
          });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      // Stop presence worker
      stopWorker();

      // Clear all pending kicks
      Object.values(pendingKicksRef.current).forEach(clearTimeout);
      pendingKicksRef.current = {};

      if (dataChannelRef.current) {
        supabase.removeChannel(dataChannelRef.current);
        dataChannelRef.current = null;
      }

      if (mediaChannelRef.current) {
        supabase.removeChannel(mediaChannelRef.current);
        mediaChannelRef.current = null;
      }

      // Clear media channel from store
      setMediaChannel(null);
    };
  }, [
    roomId,
    userId,
    supabase,
    updateRoom,
    updatePlayerState,
    addParticipant,
    updateParticipant,
    removeParticipant,
    addPlaylistItem,
    updatePlaylistItem,
    removePlaylistItem,
    addMessage,
    setPresence,
    removePresence,
    setAllPresence,
    setMediaChannel,
    syncFromRemote,
  ]);

  // Headless component - renders nothing
  return null;
}
