"use client";

import { memo, useEffect } from "react";
import { useWatchPartyStore } from "@/stores/watch-party";
import { MicrophoneIcon } from "@heroicons/react/24/outline";
import { PhoneIcon } from "@heroicons/react/24/solid";
import { Track } from "livekit-client";
import { toast } from "sonner";
import { TrackToggle, useLocalParticipant } from "@livekit/components-react";
import UserAvatar from "@/components/shared/UserAvatar";
import { WatchPartyParticipant } from "@/types/watch-party";

interface MemberVoiceFooterProps {
  myParticipantData?: WatchPartyParticipant;
  wantsVoiceConnected: boolean;
  isVoiceConnected: boolean;
  isBannedFromVoice: boolean;
  setWantsVoiceConnected: (connected: boolean) => void;
}

const selectCurrentUserId = (state: ReturnType<typeof useWatchPartyStore.getState>) =>
  state.user?.id;

const selectActiveVoiceCount = (
  state: ReturnType<typeof useWatchPartyStore.getState>,
) => {
  const currentUserId = selectCurrentUserId(state);
  let count = 0;

  for (const presence of Object.values(state.presenceData)) {
    if (presence.is_voice_connected && presence.user_id !== currentUserId) {
      count += 1;
    }
  }

  return count;
};

function MemberVoiceFooter({
  myParticipantData,
  wantsVoiceConnected,
  isVoiceConnected,
  isBannedFromVoice,
  setWantsVoiceConnected,
}: MemberVoiceFooterProps) {
  const activeVoiceCount = useWatchPartyStore(selectActiveVoiceCount);
  return (
    <div className="shrink-0 p-3 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-between rounded-b-xl z-10">
      <div className="flex items-center gap-3">
        <UserAvatar
          avatar_url={myParticipantData?.profiles?.avatar_url}
          user_name={myParticipantData?.profiles?.full_name || ""}
          size={36}
          status="online"
        />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white truncate max-w-[100px]">
            {myParticipantData?.profiles?.full_name}
          </span>
          <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest">
            Connected
          </span>
        </div>
      </div>

      {!wantsVoiceConnected ? (
        <button
          onClick={() => setWantsVoiceConnected(true)}
          className="group relative flex items-center gap-3 px-4 py-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] active:scale-95 overflow-hidden border border-emerald-400/30"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

          <div className="relative z-10 p-2 bg-black/20 rounded-xl">
            <PhoneIcon
              className={`w-4 h-4 ${activeVoiceCount > 0 ? "animate-pulse" : ""}`}
            />
          </div>

          <div className="relative z-10 flex flex-col items-start text-left">
            <span className="text-xs font-black uppercase tracking-wider leading-tight">
              Vào kênh thoại
            </span>
            {activeVoiceCount > 0 ? (
              <span className="text-[10px] text-emerald-100 font-bold flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                {activeVoiceCount} người đang đàm thoại
              </span>
            ) : (
              <span className="text-[10px] text-emerald-100/70 font-medium mt-0.5">
                Chưa có ai tham gia
              </span>
            )}
          </div>
        </button>
      ) : !isVoiceConnected ? (
        <button
          onClick={() => setWantsVoiceConnected(false)}
          className="flex items-center gap-3 px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-2xl border border-zinc-700"
        >
          <PhoneIcon className="w-4 h-4 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-wider">
            Đang kết nối...
          </span>
        </button>
      ) : (
        <VoiceControls
          isBannedFromVoice={isBannedFromVoice}
          setWantsVoiceConnected={setWantsVoiceConnected}
        />
      )}
    </div>
  );
}

function VoiceControls({
  isBannedFromVoice,
  setWantsVoiceConnected,
}: {
  isBannedFromVoice: boolean;
  setWantsVoiceConnected: (connected: boolean) => void;
}) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  useEffect(() => {
    if (!isBannedFromVoice) return;

    localParticipant?.audioTrackPublications.forEach((pub) => {
      if (!pub.isMuted) {
        pub.mute();
      }
    });

    if (isMicrophoneEnabled) {
      localParticipant?.setMicrophoneEnabled(false).catch(() => {});
      toast.error("Chủ phòng đã khóa Micro của bạn!");
    }
  }, [isBannedFromVoice, localParticipant, isMicrophoneEnabled]);

  return (
    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
      <button
        onClick={() => setWantsVoiceConnected(false)}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/40"
        title="Ngắt kết nối kênh thoại"
      >
        <PhoneIcon className="w-4 h-4 rotate-[135deg]" />
      </button>

      <TrackToggle
        source={Track.Source.Camera}
        className="flex items-center justify-center w-10 h-10 rounded-full transition-all border bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 data-[state=on]:bg-blue-500/20 data-[state=on]:border-blue-500/50 data-[state=on]:text-blue-400"
      />

      {isBannedFromVoice ? (
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full border bg-zinc-900 border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed"
          title="Bạn đã bị chủ phòng cấm Mic"
          onClick={() => toast.error("Bạn đang bị cấm sử dụng Micro")}
        >
          <div className="relative flex items-center justify-center">
            <MicrophoneIcon className="w-5 h-5" />
            <div className="absolute w-[150%] h-[2px] bg-zinc-600 rotate-45 shadow-sm" />
          </div>
        </div>
      ) : (
        <TrackToggle
          source={Track.Source.Microphone}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all border ${isMicrophoneEnabled ? "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700" : "bg-red-500/20 border-red-500/40 text-red-500 hover:bg-red-500/30"}`}
        />
      )}
    </div>
  );
}

export default memo(MemberVoiceFooter);
