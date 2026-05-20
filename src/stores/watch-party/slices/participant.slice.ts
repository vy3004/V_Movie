import { StateCreator } from "zustand";
import { mergeParticipantRealtimeRow } from "../participant-realtime";
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
      const existingIndex = state.participants.findIndex(
        (p) => p.id === participant.id || p.user_id === participant.user_id,
      );

      if (existingIndex >= 0) {
        return {
          participants: mergeParticipantRealtimeRow(
            state.participants,
            participant,
          ),
        };
      }

      return {
        participants: [...state.participants, participant],
      };
    }),

  removeParticipant: (id) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== id),
    })),

  removeParticipantByUserId: (userId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.user_id !== userId),
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

