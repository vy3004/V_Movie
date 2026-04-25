"use client";

import dynamic from "next/dynamic";
import { WatchPartyProvider } from "@/providers/WatchPartyProvider";
import { User } from "@supabase/supabase-js";
import { WatchPartyRoom, WatchPartyParticipant } from "@/types";

const WatchPartyVoiceWrapper = dynamic(
  () => import("@/components/watch-party/WatchPartyVoiceWrapper"),
  { ssr: false },
);

const WatchPartyView = dynamic(
  () => import("@/components/watch-party/WatchPartyView"),
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
