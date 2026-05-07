"use client";

import { useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import WatchPartyRealtime from "@/app/(main)/xem-chung/_components/WatchPartyRealtime";
import { User } from "@supabase/supabase-js";
import { WatchPartyRoom, WatchPartyParticipant } from "@/types";
import { useWatchPartyStore } from "@/stores/watch-party";
import { createSupabaseClient } from "@/lib/supabase/client";

const WatchPartyVoiceWrapper = dynamic(
  () => import("@/app/(main)/xem-chung/_components/WatchPartyVoiceWrapper"),
  { ssr: false },
);

const WatchPartyView = dynamic(
  () => import("@/app/(main)/xem-chung/_components/WatchPartyView"),
  { ssr: false },
);

interface WatchPartyClientProps {
  room: WatchPartyRoom;
  user: User;
  me: WatchPartyParticipant;
}

export default function WatchPartyClient({
  room: initialRoom,
  user,
  me,
}: WatchPartyClientProps) {
  // Use useRef to ensure hydration only happens once
  const isInitialized = useRef(false);

  // Hydrate Zustand store with initial data (NO RE-RENDER)
  if (!isInitialized.current) {
    const store = useWatchPartyStore.getState();
    store.setRoom(initialRoom);
    store.setUser(user);
    store.setMyParticipantId(me.id);
    store.setIsLoadingRoom(false);

    isInitialized.current = true;
  }

  // Fetch initial participants and playlist
  useEffect(() => {
    const fetchInitialData = async () => {
      const supabase = createSupabaseClient();

      // Fetch participants
      const { data: participants, error: participantsError } = await supabase
        .from("watch_party_participants")
        .select("*, profiles:user_id(full_name, avatar_url)")
        .eq("room_id", initialRoom.id);

      if (!participantsError && participants) {
        useWatchPartyStore.getState().setParticipants(participants as WatchPartyParticipant[]);
      }

      // Fetch playlist
      const { data: playlist, error: playlistError } = await supabase
        .from("watch_party_playlist")
        .select("*")
        .eq("room_id", initialRoom.id)
        .order("sort_order", { ascending: true });

      if (!playlistError && playlist) {
        useWatchPartyStore.getState().setPlaylist(playlist);
      }

      // Fetch messages
      const { data: messages, error: messagesError } = await supabase
        .from("watch_party_messages")
        .select("*")
        .eq("room_id", initialRoom.id)
        .order("created_at", { ascending: true })
        .limit(100);

      if (!messagesError && messages) {
        useWatchPartyStore.getState().setMessages(messages);
      }
    };

    fetchInitialData();
  }, [initialRoom.id]);

  // This component NEVER re-renders when Zustand state changes
  // because it doesn't subscribe to any state
  return (
    <>
      {/* Headless Realtime Sync - Handles both data and media channels */}
      <WatchPartyRealtime roomId={initialRoom.id} userId={user.id} />

      <WatchPartyVoiceWrapper room={initialRoom}>
        <WatchPartyView />
      </WatchPartyVoiceWrapper>
    </>
  );
}
