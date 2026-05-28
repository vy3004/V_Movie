"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useWatchPartyStore } from "@/stores/watch-party";
import { shouldReconnectDataChannel } from "@/stores/watch-party/data-channel-lifecycle";
import {
  mergeParticipantRealtimeRow,
  removeParticipantRealtimeRow,
} from "@/stores/watch-party/participant-realtime";
import {
  GUEST_OFFLINE_KICK_MS,
  HOST_OFFLINE_SUCCESSION_MS,
  PRESENCE_HEARTBEAT_INTERVAL_MS,
  PRESENCE_LEASE_REFRESH_INTERVAL_MS,
  getPresenceAge,
  isOfflineGuestKickLeader,
  isPresenceCleanupLeader,
  shouldKickGuestAfterOfflineTimer,
  shouldStartGuestOfflineTimer,
} from "@/stores/watch-party/presence-policy";
import {
  WatchPartyRoom,
  WatchPartyParticipant,
  UserPresence,
  ChatMessage,
  PlaylistItem,
} from "@/types";

interface WatchPartyRealtimeProps {
  roomId: string;
  userId: string;
}

const OFFLINE_CLEANUP_INTERVAL_MS = 5_000;
const SELF_PARTICIPANT_STATUS_INTERVAL_MS = 5_000;
const PARTICIPANT_BACKSTOP_REFRESH_MS = 30_000;

const createTabId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function aggregatePresence(state: ReturnType<RealtimeChannel["presenceState"]>) {
  const presenceData: Record<string, UserPresence> = {};

  Object.values(state).forEach((presences) => {
    presences.forEach((presence) => {
      const userPresence = presence as unknown as UserPresence;
      const current = presenceData[userPresence.user_id];
      const nextUpdatedAt = new Date(
        userPresence.updated_at ?? userPresence.online_at ?? 0,
      ).getTime();
      const currentUpdatedAt = new Date(
        current?.updated_at ?? current?.online_at ?? 0,
      ).getTime();

      if (current && nextUpdatedAt < currentUpdatedAt) return;

      presenceData[userPresence.user_id] = {
        ...userPresence,
        is_voice_connected:
          !!current?.is_voice_connected || !!userPresence.is_voice_connected,
        online_at: userPresence.online_at ?? current?.online_at,
      };
    });
  });

  return presenceData;
}

function chooseHostCandidate(
  participants: WatchPartyParticipant[],
  presenceData: Record<string, UserPresence>,
) {
  return participants
    .filter(
      (participant) =>
        participant.status === "approved" &&
        participant.role !== "host" &&
        !!presenceData[participant.user_id],
    )
    .sort((a, b) => {
      const scoreA =
        (presenceData[a.user_id]?.status === "online" ? 4 : 0) +
        (a.permissions?.can_manage_users ? 2 : 0) +
        (a.permissions?.can_control_media ? 1 : 0);
      const scoreB =
        (presenceData[b.user_id]?.status === "online" ? 4 : 0) +
        (b.permissions?.can_manage_users ? 2 : 0) +
        (b.permissions?.can_control_media ? 1 : 0);

      if (scoreA !== scoreB) return scoreB - scoreA;

      return (
        new Date(a.created_at || 0).getTime() -
        new Date(b.created_at || 0).getTime()
      );
    })[0];
}

export default function WatchPartyRealtime({
  roomId,
  userId,
}: WatchPartyRealtimeProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseClient(), []);
  const tabIdRef = useRef(createTabId());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isVoiceConnected = useWatchPartyStore((state) => state.isVoiceConnected);
  const isVoiceConnectedRef = useRef(isVoiceConnected);
  const presenceStatusRef = useRef<UserPresence["status"]>("online");
  const hostOfflineSinceRef = useRef<number | null>(null);
  const isPromotingHostRef = useRef(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const redirectKickedParticipant = useCallback(() => {
    const redirect = () => {
      router.replace("/xem-chung?kicked=1");
    };

    if (!document.fullscreenElement) {
      redirect();
      return;
    }

    document.exitFullscreen().then(redirect).catch(redirect);
  }, [router]);

  useEffect(() => {
    isVoiceConnectedRef.current = isVoiceConnected;

    const channel = channelRef.current;
    if (!channel || channel.state !== "joined") return;

    const now = new Date().toISOString();
    channel
      .track({
        user_id: userId,
        status: document.visibilityState === "hidden" ? "away" : "online",
        tab_id: tabIdRef.current,
        is_voice_connected: isVoiceConnected,
        updated_at: now,
        online_at: document.visibilityState === "hidden" ? undefined : now,
      })
      .catch(() => {});
  }, [isVoiceConnected, userId]);

  useEffect(() => {
    const channel = supabase.channel(`wp_data_${roomId}`, {
      config: { presence: { key: userId } },
    });
    const pendingGuestKicks: Record<string, number> = {};
    let participantRefreshTimeout: number | null = null;
    const explicitOfflineUserIds = new Set<string>();
    const staleLeaseUserIds = new Set<string>();
    const seenPresenceUserIds = new Set<string>();
    const firstSeenParticipantAt: Record<string, number> = {};
    let isCleaningUp = false;
    channelRef.current = channel;

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "watch_party_rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        useWatchPartyStore.getState().updateRoom(payload.new as WatchPartyRoom);
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "watch_party_participants",
        filter: `room_id=eq.${roomId}`,
      },
      async (payload) => {
        const store = useWatchPartyStore.getState();

        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const participant = payload.new as WatchPartyParticipant;

          if (
            participant.user_id === userId &&
            (participant.status === "blocked" || participant.status === "rejected")
          ) {
            redirectKickedParticipant();
            return;
          }

          firstSeenParticipantAt[participant.user_id] ??= Date.now();
          if (participant.status === "approved") {
            store.setParticipants(
              mergeParticipantRealtimeRow(store.participants, participant),
            );
          } else {
            store.setParticipants(
              removeParticipantRealtimeRow(store.participants, participant),
            );
          }
          scheduleParticipantRefresh();
          return;
        }

        if (payload.eventType === "DELETE") {
          const participant = payload.old as Partial<WatchPartyParticipant>;

          if (
            participant.user_id === userId ||
            participant.id === store.myParticipantId
          ) {
            redirectKickedParticipant();
            return;
          }

          store.setParticipants(
            removeParticipantRealtimeRow(store.participants, participant),
          );
          scheduleParticipantRefresh();
        }
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "watch_party_messages",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const store = useWatchPartyStore.getState();

        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          store.addMessage(payload.new as ChatMessage);
          return;
        }

        if (payload.eventType === "DELETE") {
          const message = payload.old as Partial<ChatMessage>;
          if (message.id) store.removeMessageById(message.id);
        }
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "watch_party_playlist",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const store = useWatchPartyStore.getState();

        if (payload.eventType === "INSERT") {
          store.addPlaylistItem(payload.new as PlaylistItem);
          return;
        }

        if (payload.eventType === "UPDATE") {
          const item = payload.new as PlaylistItem;
          store.updatePlaylistItem(item.id, item);
          return;
        }

        if (payload.eventType === "DELETE") {
          const item = payload.old as Partial<PlaylistItem>;
          if (item.id) store.removePlaylistItem(item.id);
        }
      },
    );
    channel.on("presence", { event: "sync" }, () => {
      const presenceData = aggregatePresence(channel.presenceState());
      const store = useWatchPartyStore.getState();

      Object.keys(presenceData).forEach((presenceUserId) => {
        seenPresenceUserIds.add(presenceUserId);
        if (explicitOfflineUserIds.has(presenceUserId)) {
          delete presenceData[presenceUserId];
        }
      });

      store.setAllPresence(presenceData);
    });

    const kickGuest = async (targetUserId: string) => {
      const state = useWatchPartyStore.getState();
      if (!state.room) return;

      const res = await fetch("/api/watch-party/participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: state.room.id,
          targetUserId,
          action: "kick",
        }),
      });

      if (!res.ok) throw new Error("Failed to kick offline participant");

      useWatchPartyStore.getState().removeParticipantByUserId(targetUserId);
    };

    const startGuestOfflineTimer = (targetUserId: string) => {
      const store = useWatchPartyStore.getState();
      store.removePresence(targetUserId);

      const { room, participants, presenceData, user, myParticipantId } = store;
      const leftParticipant = participants.find(
        (participant) => participant.user_id === targetUserId,
      );
      const myParticipant = participants.find(
        (participant) => participant.id === myParticipantId,
      );
      const effectivePresenceData = { ...presenceData };
      if (
        user &&
        myParticipant?.status === "approved" &&
        channel.state === "joined" &&
        !effectivePresenceData[user.id]
      ) {
        const now = new Date().toISOString();
        effectivePresenceData[user.id] = {
          user_id: user.id,
          status: presenceStatusRef.current,
          tab_id: tabIdRef.current,
          updated_at: now,
          online_at: presenceStatusRef.current === "online" ? now : undefined,
        } as UserPresence;
      }

      if (
        !room?.is_active ||
        !user ||
        !isOfflineGuestKickLeader({
          currentUserId: user.id,
          participants,
          presenceData: effectivePresenceData,
        }) ||
        !leftParticipant ||
        leftParticipant.role === "host" ||
        leftParticipant.status !== "approved" ||
        pendingGuestKicks[targetUserId]
      ) {
        return;
      }

      pendingGuestKicks[targetUserId] = window.setTimeout(() => {
        const latestState = useWatchPartyStore.getState();
        const participant = latestState.participants.find(
          (item) => item.user_id === targetUserId,
        );

        if (
          !participant ||
          !shouldKickGuestAfterOfflineTimer({
            participant,
            hasPresence: !!latestState.presenceData[targetUserId],
          })
        ) {
          delete pendingGuestKicks[targetUserId];
          return;
        }

        kickGuest(targetUserId)
          .catch(() => {})
          .finally(() => {
            explicitOfflineUserIds.delete(targetUserId);
            delete pendingGuestKicks[targetUserId];
          });
      }, GUEST_OFFLINE_KICK_MS);
    };

    channel.on("presence", { event: "join" }, ({ newPresences }) => {
      newPresences.forEach((presence) => {
        const userPresence = presence as unknown as UserPresence;
        seenPresenceUserIds.add(userPresence.user_id);
        explicitOfflineUserIds.delete(userPresence.user_id);
        const pendingKick = pendingGuestKicks[userPresence.user_id];
        if (!pendingKick) return;

        window.clearTimeout(pendingKick);
        delete pendingGuestKicks[userPresence.user_id];
      });
    });

    channel.on(
      "broadcast",
      { event: "presence_offline" },
      ({ payload }: { payload: { user_id?: string } }) => {
        if (!payload.user_id) return;

        explicitOfflineUserIds.add(payload.user_id);
        startGuestOfflineTimer(payload.user_id);
      },
    );

    channel.on(
      "broadcast",
      { event: "presence_status" },
      ({ payload }: { payload: { presence?: UserPresence } }) => {
        if (!payload.presence?.user_id) return;
        seenPresenceUserIds.add(payload.presence.user_id);
        if (explicitOfflineUserIds.has(payload.presence.user_id)) return;

        useWatchPartyStore
          .getState()
          .setPresence(payload.presence.user_id, payload.presence);
      },
    );

    channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
      leftPresences.forEach((presence) => {
        const userPresence = presence as unknown as UserPresence;
        const stillPresent = Object.values(channel.presenceState()).some(
          (presences) =>
            presences.some(
              (item: unknown) =>
                (item as UserPresence).user_id === userPresence.user_id,
            ),
        );

        if (!stillPresent) {
          seenPresenceUserIds.add(userPresence.user_id);
          explicitOfflineUserIds.add(userPresence.user_id);
          startGuestOfflineTimer(userPresence.user_id);
        }
      });
    });

    const sendPresenceLease = async (
      status: UserPresence["status"],
      action: "heartbeat" | "leave" = "heartbeat",
    ) => {
      const body = JSON.stringify({
        roomId,
        sessionId: tabIdRef.current,
        status,
        action,
      });

      if (action === "leave" && navigator.sendBeacon) {
        const sent = navigator.sendBeacon(
          "/api/watch-party/presence",
          new Blob([body], { type: "application/json" }),
        );
        if (sent) return;
      }

      await fetch("/api/watch-party/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    };

    const trackPresence = (status: UserPresence["status"]) => {
      presenceStatusRef.current = status;
      if (channel.state !== "joined") return;

      const now = new Date().toISOString();
      const presence: UserPresence = {
        user_id: userId,
        status,
        tab_id: tabIdRef.current,
        online_at: status === "online" ? now : undefined,
        updated_at: now,
        is_voice_connected: isVoiceConnectedRef.current,
      };

      useWatchPartyStore.getState().setPresence(userId, presence);
      channel.track(presence).catch(() => {});
      channel
        .send({
          type: "broadcast",
          event: "presence_status",
          payload: { presence },
        })
        .catch(() => {});
    };

    const handleVisibilityChange = () => {
      const status = document.visibilityState === "hidden" ? "away" : "online";
      trackPresence(status);
      sendPresenceLease(status);
    };
    const handleFocus = () => {
      if (document.visibilityState !== "visible") return;

      trackPresence("online");
      sendPresenceLease("online");
    };
    const handleBlur = () => {
      trackPresence("away");
      sendPresenceLease("away");
    };
    const markOffline = async () => {
      useWatchPartyStore.getState().removePresence(userId);
      await Promise.allSettled([
        sendPresenceLease(presenceStatusRef.current, "leave"),
        channel.send({
          type: "broadcast",
          event: "presence_offline",
          payload: { user_id: userId },
        }),
        channel.untrack(),
      ]);
    };
    const markOfflineBeforeNavigation = () =>
      Promise.race([
        markOffline(),
        new Promise<void>((resolve) => window.setTimeout(resolve, 750)),
      ]);
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.origin !== window.location.origin) return;
      if (anchor.pathname === window.location.pathname) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      event.preventDefault();
      const href = `${anchor.pathname}${anchor.search}${anchor.hash}`;
      markOfflineBeforeNavigation().finally(() => {
        window.location.assign(href);
      });
    };

    const redirectIfCurrentUserRemoved = (
      participants: WatchPartyParticipant[],
    ) => {
      const currentParticipant = participants.find(
        (participant) => participant.user_id === userId,
      );

      if (
        !currentParticipant ||
        currentParticipant.status === "blocked" ||
        currentParticipant.status === "rejected"
      ) {
        redirectKickedParticipant();
        return true;
      }

      return false;
    };

    const refetchParticipants = async () => {
      if (isRefetchingParticipants) return;
      isRefetchingParticipants = true;

      if (participantRefreshTimeout) {
        window.clearTimeout(participantRefreshTimeout);
        participantRefreshTimeout = null;
      }

      try {
        const { data, error } = await supabase
          .from("watch_party_participants")
          .select(`*, profiles:user_id(full_name, avatar_url)`)
          .eq("room_id", roomId);

        if (!error && data) {
          const nextParticipants = data as WatchPartyParticipant[];
          if (redirectIfCurrentUserRemoved(nextParticipants)) return;

          const store = useWatchPartyStore.getState();
          const nextParticipantIds = new Set(
            nextParticipants.map((participant) => participant.id),
          );

          store.participants.forEach((participant) => {
            if (!nextParticipantIds.has(participant.id)) {
              store.removeParticipant(participant.id);
            }
          });
          nextParticipants.forEach((participant) => {
            store.addParticipant(participant);
          });
        }
      } finally {
        isRefetchingParticipants = false;
      }
    };

    const scheduleParticipantRefresh = () => {
      if (participantRefreshTimeout) return;

      participantRefreshTimeout = window.setTimeout(() => {
        refetchParticipants().catch(() => {});
      }, 100);
    };

    let isRefetchingParticipants = false;
    let lastStaleLeaseRefreshAt = 0;

    const refreshStaleLeases = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastStaleLeaseRefreshAt < PRESENCE_LEASE_REFRESH_INTERVAL_MS) return;

      lastStaleLeaseRefreshAt = now;
      const res = await fetch(`/api/watch-party/presence?roomId=${roomId}`).catch(
        () => null,
      );
      if (!res?.ok) return;

      const body = (await res.json().catch(() => null)) as {
        activeLeases?: Array<{
          user_id: string;
          status: UserPresence["status"];
          session_id: string;
          last_seen_at: number;
        }>;
        staleUserIds?: string[];
      } | null;
      staleLeaseUserIds.clear();
      body?.staleUserIds?.forEach((staleUserId) => {
        staleLeaseUserIds.add(staleUserId);
      });

      const store = useWatchPartyStore.getState();
      body?.activeLeases?.forEach((lease) => {
        seenPresenceUserIds.add(lease.user_id);
        if (explicitOfflineUserIds.has(lease.user_id)) return;

        const current = store.presenceData[lease.user_id];
        const currentUpdatedAt = new Date(current?.updated_at ?? 0).getTime();
        if (current && currentUpdatedAt > lease.last_seen_at) return;

        const updatedAt = new Date(lease.last_seen_at).toISOString();
        store.setPresence(lease.user_id, {
          user_id: lease.user_id,
          status: lease.status,
          tab_id: `redis-lease:${lease.session_id}`,
          online_at: lease.status === "online" ? updatedAt : current?.online_at,
          updated_at: updatedAt,
        } as UserPresence);
      });
    };

    const runOfflineCleanup = async () => {
      const state = useWatchPartyStore.getState();
      const { room, participants, presenceData, user, myParticipantId } = state;
      if (!room?.is_active || !user) return;

      let hostOfflineSince = hostOfflineSinceRef.current;
      const isPromotingHost = isPromotingHostRef.current;

      const now = Date.now();
      const myParticipant = participants.find(
        (participant) => participant.id === myParticipantId,
      );
      const effectivePresenceData = { ...presenceData };
      if (
        myParticipant?.status === "approved" &&
        channel.state === "joined" &&
        !effectivePresenceData[user.id]
      ) {
        effectivePresenceData[user.id] = {
          user_id: user.id,
          status: presenceStatusRef.current,
          tab_id: tabIdRef.current,
          updated_at: new Date(now).toISOString(),
          online_at:
            presenceStatusRef.current === "online"
              ? new Date(now).toISOString()
              : undefined,
        } as UserPresence;
      }

      const canRunCleanup = isPresenceCleanupLeader({
        currentUserId: user.id,
        participants,
        presenceData: effectivePresenceData,
      });
      if (!canRunCleanup) return;

      await refreshStaleLeases();

      const approvedGuests = participants.filter(
        (participant) =>
          participant.status === "approved" && participant.role !== "host",
      );

      approvedGuests.forEach((participant) => {
        firstSeenParticipantAt[participant.user_id] ??= now;

        if (
          shouldStartGuestOfflineTimer({
            participant,
            now,
            explicitOfflineUserIds,
            staleLeaseUserIds,
            missingSeenPresenceUserIds: seenPresenceUserIds.has(participant.user_id) &&
              !effectivePresenceData[participant.user_id]
                ? new Set([participant.user_id])
                : undefined,
            firstSeenParticipantAt: firstSeenParticipantAt[participant.user_id],
          })
        ) {
          startGuestOfflineTimer(participant.user_id);
        }
      });

      const hostParticipant = participants.find(
        (participant) => participant.role === "host" && participant.status === "approved",
      );
      const hostPresence = hostParticipant
        ? effectivePresenceData[hostParticipant.user_id]
        : undefined;
      const cleanupPresenceData = effectivePresenceData;
      const hostPresenceAge = getPresenceAge(hostPresence, now);
      if (!hostParticipant) {
        hostOfflineSince = null;
        hostOfflineSinceRef.current = null;
        return;
      }

      if (hostPresence && hostPresenceAge <= HOST_OFFLINE_SUCCESSION_MS) {
        hostOfflineSince = null;
        hostOfflineSinceRef.current = null;
        return;
      }

      const hasExplicitHostOfflineSignal =
        explicitOfflineUserIds.has(hostParticipant.user_id) ||
        staleLeaseUserIds.has(hostParticipant.user_id);

      const hostPresenceUpdatedAt = new Date(hostPresence?.updated_at ?? 0).getTime();
      const hostFirstSeenAt = firstSeenParticipantAt[hostParticipant.user_id];
      const hostOfflineStart =
        Number.isFinite(hostPresenceUpdatedAt) && hostPresenceUpdatedAt > 0
          ? hostPresenceUpdatedAt
          : hasExplicitHostOfflineSignal && hostFirstSeenAt
            ? hostFirstSeenAt
            : hostOfflineSince ?? now;
      hostOfflineSince = hostOfflineSince === null ? hostOfflineStart : Math.min(hostOfflineSince, hostOfflineStart);
      hostOfflineSinceRef.current = hostOfflineSince;
      if (now - hostOfflineSince < HOST_OFFLINE_SUCCESSION_MS || isPromotingHost) {
        return;
      }

      const candidate = chooseHostCandidate(participants, cleanupPresenceData);
      if (!candidate || candidate.user_id !== user.id || !myParticipantId) return;

      isPromotingHostRef.current = true;
      try {
        const { error: cleanupError } = await supabase.rpc("cleanup_ghost_hosts", {
          p_room_id: room.id,
          p_ghost_host_ids: [hostParticipant.id],
        });

        if (cleanupError) throw cleanupError;

        const { data: promoted, error } = await supabase.rpc(
          "promote_to_host_atomic",
          {
            p_room_id: room.id,
            p_candidate_id: myParticipantId,
          },
        );

        if (error) throw error;

        if (promoted) {
          toast.success("Host cũ đã offline. Bạn được chuyển thành Chủ phòng mới!");
          await refetchParticipants();
        }
      } catch (error) {
        console.error("[WP_HOST_SUCCESSION_ERROR]:", error);
      } finally {
        isPromotingHostRef.current = false;
        hostOfflineSince = null;
        hostOfflineSinceRef.current = null;
      }
    };

    const selfParticipantStatusInterval = window.setInterval(() => {
      if (useWatchPartyStore.getState().dataChannelStatus === "joined") return;

      supabase
        .from("watch_party_participants")
        .select("id, user_id, status")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) return;
          if (
            !data ||
            data.status === "blocked" ||
            data.status === "rejected"
          ) {
            redirectKickedParticipant();
          }
        });
    }, SELF_PARTICIPANT_STATUS_INTERVAL_MS);

    const participantRefreshInterval = window.setInterval(
      refetchParticipants,
      PARTICIPANT_BACKSTOP_REFRESH_MS,
    );
    const presenceHeartbeatInterval = window.setInterval(
      () => {
        trackPresence(presenceStatusRef.current);
      },
      PRESENCE_HEARTBEAT_INTERVAL_MS,
    );
    const presenceLeaseHeartbeatInterval = window.setInterval(
      () => {
        sendPresenceLease(presenceStatusRef.current);
      },
      PRESENCE_HEARTBEAT_INTERVAL_MS,
    );
    const offlineCleanupInterval = window.setInterval(
      () => {
        runOfflineCleanup().catch(() => {});
      },
      OFFLINE_CLEANUP_INTERVAL_MS,
    );

    channel.subscribe((subscriptionStatus) => {
      if (process.env.NODE_ENV === "development") {
        console.log("[wp_data]", subscriptionStatus);
      }

      const store = useWatchPartyStore.getState();

      if (subscriptionStatus === "SUBSCRIBED") {
        const presenceStatus = document.visibilityState === "hidden" ? "away" : "online";
        store.setDataChannel(channel);
        store.setDataChannelStatus("joined", channel);
        trackPresence(presenceStatus);
        sendPresenceLease(presenceStatus);
        refetchParticipants();
        return;
      }

      if (subscriptionStatus === "CHANNEL_ERROR") {
        store.setDataChannelStatus("error", channel);
        refetchParticipants();
      }

      if (subscriptionStatus === "TIMED_OUT") {
        store.setDataChannelStatus("timed_out", channel);
        refetchParticipants();
      }

      if (subscriptionStatus === "CLOSED") {
        store.setDataChannelStatus("closed", channel);
      }

      if (!isCleaningUp && shouldReconnectDataChannel(subscriptionStatus)) {
        setReconnectAttempt((attempt) => attempt + 1);
      }
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      isCleaningUp = true;
      window.clearInterval(selfParticipantStatusInterval);
      window.clearInterval(participantRefreshInterval);
      window.clearInterval(presenceHeartbeatInterval);
      window.clearInterval(presenceLeaseHeartbeatInterval);
      window.clearInterval(offlineCleanupInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("click", handleDocumentClick, true);
      Object.values(pendingGuestKicks).forEach((timer) => {
        window.clearTimeout(timer);
      });
      if (participantRefreshTimeout) {
        window.clearTimeout(participantRefreshTimeout);
      }
      channel.untrack().catch(() => {});
      useWatchPartyStore.getState().setDataChannel(null);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId, userId, router, supabase, reconnectAttempt, redirectKickedParticipant]);

  return null;
}









