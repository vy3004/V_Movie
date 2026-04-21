"use client";

import React from "react";
import WatchPartyView from "@/components/watch-party/WatchPartyView";
import { WatchPartyProvider } from "@/providers/WatchPartyProvider";
import { User } from "@supabase/supabase-js";
import { WatchPartyRoom, WatchPartyParticipant } from "@/types";

interface WatchPartyClientProps {
  room: WatchPartyRoom;
  user: User;
  me: WatchPartyParticipant;
}

export default function WatchPartyClient({
  room: initialRoom,
  user,
  me: initialMe,
}: WatchPartyClientProps) {
  return (
    <WatchPartyProvider
      roomId={initialRoom.id}
      user={user}
      initialRoom={initialRoom}
      initialMe={initialMe}
    >
      <WatchPartyView />
    </WatchPartyProvider>
  );
}
