import { StateCreator } from "zustand";
import { PresenceSlice } from "./types";

const initialState = {
  presenceData: {},
};

export const createPresenceSlice: StateCreator<PresenceSlice> = (set) => ({
  ...initialState,

  setPresence: (userId, presence) =>
    set((state) => ({
      presenceData: {
        ...state.presenceData,
        [userId]: presence,
      },
    })),

  removePresence: (userId) =>
    set((state) => {
      const newPresenceData = { ...state.presenceData };
      delete newPresenceData[userId];
      return { presenceData: newPresenceData };
    }),

  setAllPresence: (presenceData) => set({ presenceData }),

  reset: () => set(initialState),
});
