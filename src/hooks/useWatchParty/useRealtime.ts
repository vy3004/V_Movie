"use client";

import { useEffect, useRef } from "react";
import { QueryClient } from "@tanstack/react-query";
import {
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import {
  WatchPartyRoom,
  WatchPartyParticipant,
  PlayerSyncRef,
  ChatMessage,
} from "@/types";

interface RealtimeProps {
  room: WatchPartyRoom;
  userId: string;
  myParticipantId: string | undefined;
  supabase: SupabaseClient;
  queryClient: QueryClient;
  isRealHost: boolean;
  canControl: boolean;
  playerSyncRef: React.MutableRefObject<PlayerSyncRef | null>;
  setRoom: (room: WatchPartyRoom) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sendControl: (
    action: "play" | "pause" | "seek",
    time: number,
    slug?: string,
  ) => void;
  refetchParticipants: () => void;
  onKicked: () => void;
}

export function useRealtime(props: RealtimeProps) {
  const refs = useRef(props);

  useEffect(() => {
    refs.current = props;
  });

  useEffect(() => {
    const timeoutIds: NodeJS.Timeout[] = [];

    const channel = refs.current.supabase.channel(`wp_ui_${props.room.id}`, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "watch_party_messages",
          filter: `room_id=eq.${props.room.id}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          refs.current.setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            const updated = [...prev, newMessage];
            if (updated.length > 150) {
              return updated.slice(updated.length - 150);
            }
            return updated;
          });
        },
      )
      .on(
        "broadcast",
        { event: "change_episode_sync" },
        async ({ payload }) => {
          refs.current.setRoom({
            ...refs.current.room,
            current_episode_slug: payload.slug,
            ...(payload.movie_slug && {
              current_movie_slug: payload.movie_slug,
              movie_image: payload.movie_image,
            }),
          });

          if (refs.current.playerSyncRef?.current) {
            refs.current.playerSyncRef.current.syncFromRemote("play", 0);
          }

          if (refs.current.isRealHost) {
            const updateData = {
              current_episode_slug: payload.slug,
              ...(payload.movie_slug && {
                current_movie_slug: payload.movie_slug,
                movie_image: payload.movie_image,
              }),
            };

            await refs.current.supabase
              .from("watch_party_rooms")
              .update(updateData)
              .eq("id", props.room.id);
          }
        },
      )
      .on("broadcast", { event: "request_sync_from_host" }, () => {
        if (refs.current.isRealHost) {
          const state = refs.current.playerSyncRef.current?.getCurrentState?.();
          if (state) {
            refs.current.sendControl(
              state.isPaused ? "pause" : "play",
              state.time,
            );
          }
        }
      })
      .on("broadcast", { event: "request_sync_from_room" }, () => {
        if (!refs.current.isRealHost) {
          const state = refs.current.playerSyncRef.current?.getCurrentState?.();
          if (state) {
            setTimeout(() => {
              if (channel.state === "joined") {
                channel
                  .send({
                    type: "broadcast",
                    event: "room_sync_response",
                    payload: {
                      action: state.isPaused ? "pause" : "play",
                      time: state.time,
                    },
                  })
                  .catch(() => {});
              }
            }, Math.random() * 1000);
          }
        }
      })
      .on("broadcast", { event: "room_sync_response" }, ({ payload }) => {
        if (refs.current.isRealHost) {
          refs.current.playerSyncRef.current?.syncFromRemote(
            payload.action,
            payload.time,
          );
        }
      })
      .on("broadcast", { event: "heartbeat_sync" }, ({ payload }) => {
        if (
          !refs.current.canControl &&
          payload.senderId !== refs.current.userId
        ) {
          refs.current.playerSyncRef.current?.syncFromRemote(
            payload.isPaused ? "pause" : "play",
            payload.time,
          );
        }
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "watch_party_rooms",
          filter: `id=eq.${props.room.id}`,
        },
        (p) => {
          const updatedRoom = p.new as WatchPartyRoom;
          refs.current.setRoom(updatedRoom);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watch_party_participants",
          filter: `room_id=eq.${props.room.id}`,
        },
        (payload: RealtimePostgresChangesPayload<WatchPartyParticipant>) => {
          refs.current.refetchParticipants();
          if (payload.eventType === "DELETE") {
            refs.current.queryClient.setQueryData<WatchPartyParticipant[]>(
              ["wp-participants", props.room.id],
              (old = []) => old.filter((p) => p.id !== payload.old.id),
            );
            if (payload.old?.id === refs.current.myParticipantId)
              refs.current.onKicked();
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (!refs.current.isRealHost) {
            const requestSync = async () => {
              if (channel.state !== "joined") return;
              try {
                await channel.send({
                  type: "broadcast",
                  event: "request_sync_from_host",
                  payload: {},
                });
              } catch (error) {
                console.warn("[WatchParty] request_sync_from_host:", error);
              }
            };
            timeoutIds.push(setTimeout(requestSync, 1500));
            timeoutIds.push(setTimeout(requestSync, 3500));
            timeoutIds.push(setTimeout(requestSync, 6000));
          } else {
            const requestRecovery = async () => {
              if (channel.state !== "joined") return;
              try {
                await channel.send({
                  type: "broadcast",
                  event: "request_sync_from_room",
                  payload: {},
                });
              } catch (error) {
                console.warn("[WatchParty] request_recovery:", error);
              }
            };
            timeoutIds.push(setTimeout(requestRecovery, 2000));
            timeoutIds.push(setTimeout(requestRecovery, 4000));
          }
        }
      });

    return () => {
      timeoutIds.forEach((id) => clearTimeout(id));
      refs.current.supabase.removeChannel(channel);
    };
  }, [props.room.id]);
}
