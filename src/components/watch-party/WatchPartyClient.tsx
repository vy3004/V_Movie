"use client";

import React from "react";
import WatchPartyView from "@/components/watch-party/WatchPartyView";
import WatchPartyVoiceWrapper from "@/components/watch-party/WatchPartyVoiceWrapper";
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
      <WatchPartyVoiceWrapper room={initialRoom}>
        <WatchPartyView />
      </WatchPartyVoiceWrapper>
    </WatchPartyProvider>
  );
}
