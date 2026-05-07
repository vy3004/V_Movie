import { StateCreator } from "zustand";
import { ParticipantSlice } from "./types";

const initialState = {
  participants: [],
  myParticipantId: null,
};

export const createParticipantSlice: StateCreator<ParticipantSlice> = (
  set,
) => ({
  ...initialState,

  setParticipants: (participants) => set({ participants }),

  addParticipant: (participant) =>
    set((state) => {
      // Prevent duplicates
      if (state.participants.some((p) => p.id === participant.id)) {
        return state;
      }
      return {
        participants: [...state.participants, participant],
      };
    }),

  removeParticipant: (id) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== id),
    })),

  updateParticipant: (id, updates) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === id ? { ...p, ...updates } : p,
      ),
    })),

  setMyParticipantId: (myParticipantId) => set({ myParticipantId }),

  reset: () => set(initialState),
});
