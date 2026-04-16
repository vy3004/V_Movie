"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { throttle } from "lodash-es";

export function useWatchParty(
  roomId: string | null,
  isHost: boolean,
  syncFromRemote: (action: "play" | "pause" | "seek", time: number) => void,
  onChangeEpisode?: (slug: string) => void,
) {
  const channelRef = useRef<any>(null);
  const [presenceData, setPresenceData] = useState<Record<string, any>>({});
  const hasSyncedInitial = useRef(false);
  const supabase = createSupabaseClient();

  const { data: initialData, isLoading: isLoadingRoom } = useQuery({
    queryKey: ["watch-party", roomId],
    queryFn: async () => {
      if (!roomId) return null;
      const res = await fetch(`/api/watch-party?roomId=${roomId}`);
      return res.json();
    },
    enabled: !!roomId,
    refetchOnWindowFocus: false,
  });

  const { mutate: syncToBackend } = useMutation({
    mutationFn: async (payload: any) => {
      await fetch("/api/watch-party/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
  });

  const throttledSyncAPI = useRef(
    throttle((payload: any) => {
      syncToBackend(payload);
    }, 2000),
  ).current;

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`watch-party:${roomId}`, {
      config: { presence: { key: roomId }, broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "video_control" }, ({ payload }) => {
        if (payload.episodeSlug && onChangeEpisode)
          onChangeEpisode(payload.episodeSlug);
        syncFromRemote(payload.action, payload.time);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: Record<string, any> = {};
        Object.values(state)
          .flat()
          .forEach((p: any) => {
            users[p.user_id] = p;
          });
        setPresenceData(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          const trackUser = (userStatus: "online" | "away") => {
            channel.track({
              user_id: user?.id,
              user_name: user?.user_metadata?.full_name || "Khách",
              status: userStatus,
              online_at: new Date().toISOString(),
            });
          };

          trackUser("online");

          // Xử lý trạng thái Vàng (Away) khi ẩn tab trình duyệt
          const handleVisibility = () => {
            trackUser(
              document.visibilityState === "visible" ? "online" : "away",
            );
          };
          document.addEventListener("visibilitychange", handleVisibility);
          return () =>
            document.removeEventListener("visibilitychange", handleVisibility);
        }
      });

    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      throttledSyncAPI.cancel();
    };
  }, [roomId, syncFromRemote, throttledSyncAPI, onChangeEpisode, supabase]);

  const sendControl = useCallback(
    (action: "play" | "pause" | "seek", time: number, episodeSlug?: string) => {
      if (!roomId || !channelRef.current) return;
      channelRef.current.send({
        type: "broadcast",
        event: "video_control",
        payload: { action, time, episodeSlug },
      });
      const payload = {
        roomId,
        status: action === "seek" ? undefined : action,
        time,
        episodeSlug,
      };
      if (action === "seek" || episodeSlug) syncToBackend(payload);
      else throttledSyncAPI(payload);
    },
    [roomId, syncToBackend, throttledSyncAPI],
  );

  return {
    sendControl,
    presenceData,
    roomData: initialData?.room,
    isLoadingRoom,
  };
}
