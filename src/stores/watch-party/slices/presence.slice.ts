import { StateCreator } from "zustand";
import { UserPresence } from "@/types";
import { PresenceSlice } from "./types";

const initialState = {
  presenceData: {},
};

const hasSamePresence = (
  current: UserPresence | undefined,
  next: UserPresence,
) =>
  current?.user_id === next.user_id &&
  current?.status === next.status &&
  current?.tab_id === next.tab_id &&
  current?.is_voice_connected === next.is_voice_connected &&
  current?.updated_at === next.updated_at &&
  current?.online_at === next.online_at;

const createPresenceSignature = (presenceData: Record<string, UserPresence>) =>
  Object.values(presenceData)
    .map((presence) =>
      [
        presence.user_id,
        presence.status,
        presence.tab_id ?? "",
        presence.is_voice_connected ? "1" : "0",
        presence.updated_at ?? "",
        presence.online_at ?? "",
      ].join(":"),
    )
    .sort()
    .join("|");

export const createPresenceSlice: StateCreator<PresenceSlice> = (set) => ({
  ...initialState,

  setPresence: (userId, presence) =>
    set((state) => {
      if (hasSamePresence(state.presenceData[userId], presence)) return state;

      return {
        presenceData: {
          ...state.presenceData,
          [userId]: presence,
        },
      };
    }),

  removePresence: (userId) =>
    set((state) => {
      if (!state.presenceData[userId]) return state;

      const newPresenceData = { ...state.presenceData };
      delete newPresenceData[userId];
      return { presenceData: newPresenceData };
    }),

  setAllPresence: (presenceData) =>
    set((state) => {
      if (createPresenceSignature(state.presenceData) === createPresenceSignature(presenceData)) {
        return state;
      }

      return { presenceData };
    }),

  reset: () => set(initialState),
});
