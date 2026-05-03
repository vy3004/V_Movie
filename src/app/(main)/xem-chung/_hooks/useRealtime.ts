"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import {
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import { isEqual } from "lodash-es";
import {
  WatchPartyRoom,
  WatchPartyParticipant,
  PlayerSyncRef,
  ChatMessage,
  UserPresence,
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
  const channelRef = useRef<ReturnType<SupabaseClient["channel"]> | null>(null);

  // REF MỚI: Lưu trữ các timeout kick user để xử lý Grace Period (Chống F5/Strict Mode)
  const pendingKicksRef = useRef<Record<string, NodeJS.Timeout>>({});

  // STATE MỚI: Lưu presence data để share với useHostSuccession
  const [realtimePresence, setRealtimePresence] = useState<Record<string, UserPresence>>({});

  useEffect(() => {
    refs.current = props;
  });

  useEffect(() => {
    const timeoutIds: NodeJS.Timeout[] = [];
    let isUnmounted = false;

    // CẤU HÌNH PRESENCE KEY: Dùng userId làm key để dễ track ai vừa out
    const channel = refs.current.supabase.channel(`wp_ui_${props.room.id}`, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: props.userId },
      },
    });

    channelRef.current = channel;

    channel
      // -------------------------------------------------------------
      // SUPABASE PRESENCE: LẮNG NGHE SỰ KIỆN KẾT NỐI (JOIN/LEAVE)
      // -------------------------------------------------------------
      .on("presence", { event: "join" }, ({ key }) => {
        // Chỉ Host mới cần xử lý logic Kick
        if (!refs.current.isRealHost) return;

        const joinedUserId = key;

        // Nếu user này đang nằm trong danh sách chuẩn bị bị kick (do vừa ngắt kết nối)
        // -> Chắc chắn họ vừa F5 hoặc do Strict Mode re-mount. Hủy lệnh kick ngay!
        if (pendingKicksRef.current[joinedUserId]) {
          clearTimeout(pendingKicksRef.current[joinedUserId]);
          delete pendingKicksRef.current[joinedUserId];
        }
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        if (!refs.current.isRealHost) return;

        const leftUserId = key;
        // Host không tự kick chính mình thông qua flow này
        if (leftUserId === refs.current.userId) return;

        // Đợi 15 giây (Grace Period). Nếu không quay lại -> Xóa thẳng khỏi DB
        // Tăng từ 5s lên 15s để user có đủ thời gian load khi mạng chậm
        pendingKicksRef.current[leftUserId] = setTimeout(async () => {
          try {
            const response = await fetch("/api/watch-party/participant", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                roomId: refs.current.room.id,
                targetUserId: leftUserId,
                action: "kick",
              }),
            });
            if (!response.ok) {
              console.error("[WatchParty] Leave request kick failed:", response.status);
            }
          } catch (error) {
            console.error("[WatchParty] Lỗi khi kick offline user:", error);
          } finally {
            delete pendingKicksRef.current[leftUserId];
          }
        }, 15000); // Tăng từ 5000ms lên 15000ms
      })
      .on("presence", { event: "sync" }, () => {
        // Đồng bộ presence data để share với useHostSuccession
        const state = channel.presenceState();
        const users: Record<string, UserPresence> = {};
        Object.values(state)
          .flat()
          .forEach((p) => {
            const user = p as unknown as UserPresence;
            users[user.user_id] = user;
          });

        // FIX: Tránh re-render toàn app nếu trạng thái chớp nháy không đổi
        setRealtimePresence((prev) => {
          if (isEqual(prev, users)) return prev;
          return users;
        });
      })
      // -------------------------------------------------------------
      // CÁC SỰ KIỆN BROADCAST / POSTGRES CŨ (GIỮ NGUYÊN)
      // -------------------------------------------------------------
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

            const { error } = await refs.current.supabase
              .from("watch_party_rooms")
              .update(updateData)
              .eq("id", props.room.id);
            if (error) {
              console.error("[WatchParty] Failed to update room:", error);
            }
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
              // BẢO VỆ AN TOÀN: Chỉ gửi nếu channel còn sống VÀ chưa bị unmount
              if (!isUnmounted && channel.state === "joined") {
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
      // NOTE: Giữ request_leave cho trường hợp user BẤM NÚT RỜI PHÒNG (Leave thủ công)
      .on("broadcast", { event: "request_leave" }, async ({ payload }) => {
        // Chỉ host mới xử lý request leave
        if (!refs.current.isRealHost) return;

        const { userId } = payload;
        if (!userId) return;

        // Host tự động kick user đã request leave (KHÔNG ĐỢI 5s)
        try {
          const response = await fetch("/api/watch-party/participant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId: props.room.id,
              targetUserId: userId,
              action: "kick",
            }),
          });
          if (!response.ok) {
            console.error("[WatchParty] Kick API returned error:", response.status);
          }
        } catch (error) {
          console.error("[WatchParty] Failed to process leave request:", error);
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
          const queryClient = refs.current.queryClient;
          const queryKey = ["wp-participants", props.room.id];

          if (payload.eventType === "DELETE") {
            // Kiểm tra xem user có thực sự đã join chưa TRƯỚC KHI xóa khỏi cache
            const wasInRoom = queryClient
              .getQueryData<WatchPartyParticipant[]>(queryKey)
              ?.some((p) => p.user_id === refs.current.userId);

            queryClient.setQueryData<WatchPartyParticipant[]>(
              queryKey,
              (old = []) => old.filter((p) => p.id !== payload.old?.id),
            );

            // CHỈ trigger onKicked nếu:
            // 1. Record bị xóa là của mình
            // 2. Mình đã thực sự có trong participants list (không phải chỉ có initialMe)
            if (payload.old?.id === refs.current.myParticipantId && wasInRoom) {
              refs.current.onKicked();
            }
          } else if (payload.eventType === "INSERT") {
            // Thêm trực tiếp vào Cache, KHÔNG gọi API
            queryClient.setQueryData<WatchPartyParticipant[]>(queryKey, (old = []) => {
              if (old.some((p) => p.id === payload.new.id)) return old;
              return [...old, payload.new as WatchPartyParticipant];
            });
          } else if (payload.eventType === "UPDATE") {
            // Cập nhật Cache trực tiếp
            queryClient.setQueryData<WatchPartyParticipant[]>(queryKey, (old = []) =>
              old.map((p) =>
                p.id === payload.new.id ? { ...p, ...(payload.new as WatchPartyParticipant) } : p,
              ),
            );
          }
        },
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // TRACK PRESENCE NGAY KHI SUBSCRIBED THÀNH CÔNG
          await channel.track({
            user_id: refs.current.userId,
            online_at: new Date().toISOString(),
          });

          if (!refs.current.isRealHost) {
            let syncReceived = false;

            const requestSync = async () => {
              if (channel.state !== "joined" || syncReceived) return;
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

            // ✅ FALLBACK: Nếu Host không trả lời sau 8 giây, gọi API lấy state từ DB
            timeoutIds.push(setTimeout(async () => {
              if (channel.state !== "joined" || syncReceived) return;
              console.log("[WatchParty] Guest: No host response, fetching from API");
              try {
                const res = await fetch(`/api/watch-party?roomId=${refs.current.room.id}`);
                if (res.ok) {
                  const data = await res.json();
                  if (data.state && data.state.time !== undefined) {
                    syncReceived = true;
                    const action = data.state.status === "pause" ? "pause" : "play";
                    refs.current.playerSyncRef.current?.syncFromRemote(action, data.state.time);
                  }
                }
              } catch (error) {
                console.error("[WatchParty] Guest: Failed to fetch fallback state:", error);
              }
            }, 8000));
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

    // CLEANUP FUNCTION (Dọn dẹp khi Component bị hủy)
    return () => {
      isUnmounted = true;
      timeoutIds.forEach((id) => clearTimeout(id));

      // DỌN DẸP GRACE PERIOD TIMEOUTS ĐỂ TRÁNH MEMORY LEAK
      Object.values(pendingKicksRef.current).forEach(clearTimeout);
      pendingKicksRef.current = {};

      refs.current.supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [props.room.id, props.userId]);

  // Return presence data để WatchPartyProvider có thể truyền cho useHostSuccession
  return { realtimePresence };
}
