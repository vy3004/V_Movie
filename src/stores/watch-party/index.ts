import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createRoomSlice } from "./slices/room.slice";
import { createParticipantSlice } from "./slices/participant.slice";
import { createChatSlice } from "./slices/chat.slice";
import { createPlaylistSlice } from "./slices/playlist.slice";
import { createPresenceSlice } from "./slices/presence.slice";
import { WatchPartyStore } from "./slices/types";

export type { WatchPartyStore };

export const useWatchPartyStore = create<WatchPartyStore>()(
  devtools(
    (...args) => ({
      ...createRoomSlice(...args),
      ...createParticipantSlice(...args),
      ...createChatSlice(...args),
      ...createPlaylistSlice(...args),
      ...createPresenceSlice(...args),
    }),
    {
      name: "WatchPartyStore",
      enabled: process.env.NODE_ENV === "development",
    },
  ),
);

// Export store for non-React usage
export const getWatchPartyStore = () => useWatchPartyStore.getState();

// Helper function to reset all slices
export const resetWatchPartyStore = () => {
  useWatchPartyStore.setState({
    room: null,
    isLoading: false,
    error: null,
    user: null,
    dataChannel: null,
    dataChannelStatus: "closed",
    activeTab: "chat",
    isSidebarOpen: true,
    isSettingsModalOpen: false,
    wantsVoiceConnected: false,
    isVoiceConnected: false,
    kickTarget: null,
    isKicked: false,
    openMenuId: null,
    isLoadingRoom: false,
    initialState: null,
    participants: [],
    myParticipantId: null,
    messages: [],
    isLoadingMessages: false,
    unreadCount: 0,
    lastReadMessageId: null,
    playlist: [],
    isLoadingPlaylist: false,
    dragItem: null,
    dragOverItem: null,
    presenceData: {},
  });
};

// Re-export playlist actions
export * from "./actions/playlist.actions";

// Re-export chat actions
export * from "./actions/chat.actions";

// Re-export participant actions
export * from "./actions/participant.actions";

// Re-export video actions
export * from "./actions/video.actions";

// Re-export selectors
export * from "./selectors";
