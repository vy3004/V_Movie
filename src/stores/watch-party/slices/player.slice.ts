import { StateCreator } from "zustand";
import { PlayerSlice } from "./types";

const initialState = {
  playerSyncRef: null,
  isSyncing: false,
  currentTime: 0,
  isPaused: true,
  _lastSyncTimestamp: 0,
};

export const createPlayerSlice: StateCreator<PlayerSlice> = (set, get) => ({
  ...initialState,

  setPlayerSyncRef: (playerSyncRef) => set({ playerSyncRef }),

  setIsSyncing: (isSyncing) => set({ isSyncing }),

  updatePlayerState: (currentTime, isPaused) => set({ currentTime, isPaused }),

  syncFromRemote: (action, time) => {
    const { playerSyncRef } = get();
    console.log("[PlayerSlice] syncFromRemote called:", {
      action,
      time,
      hasRef: !!playerSyncRef,
      hasSyncFn: !!playerSyncRef?.syncFromRemote,
    });

    if (playerSyncRef?.syncFromRemote) {
      playerSyncRef.syncFromRemote(action, time);

      // Update internal timestamp (không trigger re-render)
      get()._lastSyncTimestamp = Date.now();
    } else {
      console.warn("[PlayerSlice] playerSyncRef not available");
    }
  },

  reset: () => set(initialState),
});
