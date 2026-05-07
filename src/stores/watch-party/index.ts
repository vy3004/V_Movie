import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createRoomSlice } from "./slices/room.slice";
import { createParticipantSlice } from "./slices/participant.slice";
import { createChatSlice } from "./slices/chat.slice";
import { createPlayerSlice } from "./slices/player.slice";
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
      ...createPlayerSlice(...args),
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
  const state = useWatchPartyStore.getState();

  // Call reset on each slice if it exists
  if (typeof state.reset === "function") {
    state.reset();
  }
};

// Re-export all selectors
export * from "./selectors";

// Re-export playlist actions
export * from "./actions/playlist.actions";

// Re-export chat actions
export * from "./actions/chat.actions";

// Re-export video actions
export * from "./actions/video.actions";

// Re-export participant actions
export * from "./actions/participant.actions";
