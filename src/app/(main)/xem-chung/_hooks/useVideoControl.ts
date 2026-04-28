"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { useQuery, useMutation } from "@tanstack/react-query";
import { debounce } from "lodash-es";
import { SyncApiPayload, UserPresence } from "@/types";

export function useVideoControl(
  roomId: string | null,
  userId: string | undefined,
  canControl: boolean,
  supabase: SupabaseClient,
  syncFromRemote: (
    action: "play" | "pause" | "seek",
    time: number,
    slug?: string,
  ) => void,
  onChangeEpisode?: (slug: string) => void,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [presenceData, setPresenceData] = useState<
    Record<string, UserPresence>
  >({});
  const refs = useRef({ canControl, syncFromRemote, onChangeEpisode });

  useEffect(() => {
    refs.current = { canControl, syncFromRemote, onChangeEpisode };
  });

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

  const { mutate: syncToBackend } = useMutation({
    mutationFn: async (payload: SyncApiPayload) => {
      if (!refs.current.canControl) return;
      await fetch("/api/watch-party/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
  });

  const debouncedSyncAPI = useRef(
    debounce((payload: SyncApiPayload) => syncToBackend(payload), 400),
  ).current;

  useEffect(() => {
    if (!roomId || !userId) return;

    const setupChannel = () => {
      const channel = supabase.channel(`wp_video_${roomId}`, {
        config: {
          presence: { key: roomId },
          broadcast: { ack: false, self: false },
        },
      });

      channel
        .on("broadcast", { event: "video_control" }, ({ payload }) => {
          if (payload.senderId === userId) return;

          if (payload.episodeSlug && refs.current.onChangeEpisode) {
            refs.current.onChangeEpisode(payload.episodeSlug);
          }
          refs.current.syncFromRemote(payload.action, payload.time);
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const users: Record<string, UserPresence> = {};
          Object.values(state)
            .flat()
            .forEach((p) => {
              const user = p as unknown as UserPresence;
              users[user.user_id] = user;
            });
          setPresenceData(users);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            channel
              .track({
                user_id: userId,
                status: "online",
                updated_at: new Date().toISOString(),
              })
              .catch(() => {});
          }
        });

      return channel;
    };

    channelRef.current = setupChannel();

    const handleVisibilityChange = () => {
      const channel = channelRef.current;
      if (!channel) return;

      if (document.visibilityState === "hidden") {
        channel
          .track({
            user_id: userId,
            status: "away",
            updated_at: new Date().toISOString(),
          })
          .catch(() => {});
      } else {
        const isDisconnected =
          channel.state === "closed" || channel.state === "errored";

        if (isDisconnected) {
          supabase.removeChannel(channel);
          channelRef.current = setupChannel();
        } else {
          channel
            .track({
              user_id: userId,
              status: "online",
              updated_at: new Date().toISOString(),
            })
            .catch(() => {});
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channelRef.current) {
        channelRef.current.untrack().catch(() => {});
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId, userId, supabase]);

  const sendControl = useCallback(
    (action: "play" | "pause" | "seek", time: number, episodeSlug?: string) => {
      if (!roomId || !channelRef.current || !refs.current.canControl) return;

      if (channelRef.current.state === "joined") {
        channelRef.current
          .send({
            type: "broadcast",
            event: "video_control",
            payload: { action, time, episodeSlug, senderId: userId },
          })
          .catch((err: Error) => {
            console.error("Lỗi gửi Broadcast:", err);
          });
      } else {
        console.warn(
          "Channel chưa sẵn sàng, lệnh bị hủy để tránh lỗi REST API.",
        );
      }

      debouncedSyncAPI({
        roomId,
        status: action === "seek" ? undefined : action,
        time,
        episodeSlug,
      });
    },
    [roomId, userId, debouncedSyncAPI],
  );

  return {
    sendControl,
    presenceData,
    roomData: initialData?.room,
    initialState: initialData?.state,
    isLoadingRoom,
  };
}
