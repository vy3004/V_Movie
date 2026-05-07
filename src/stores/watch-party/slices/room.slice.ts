import { StateCreator } from "zustand";
import { RoomSlice } from "./types";

const initialState = {
  room: null,
  isLoading: false,
  error: null,
  user: null,
  mediaChannel: null,
  activeTab: "chat" as const,
  isSidebarOpen: true,
  isSettingsModalOpen: false,
  kickTarget: null,
  isKicked: false,
  openMenuId: null,
  isLoadingRoom: false,
  initialState: null,
};

export const createRoomSlice: StateCreator<RoomSlice> = (set) => ({
  ...initialState,

  setRoom: (room) => set({ room, isLoading: false, error: null }),

  updateRoom: (updates) =>
    set((state) => ({
      room: state.room ? { ...state.room, ...updates } : null,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  setUser: (user) => set({ user }),

  setMediaChannel: (mediaChannel) => set({ mediaChannel }),

  setActiveTab: (activeTab) => set({ activeTab }),

  toggleSidebar: () =>
    set((state) => ({
      isSidebarOpen: !state.isSidebarOpen,
    })),

  openSettingsModal: () => set({ isSettingsModalOpen: true }),

  closeSettingsModal: () => set({ isSettingsModalOpen: false }),

  setKickTarget: (kickTarget) => set({ kickTarget }),

  setIsKicked: (isKicked) => set({ isKicked }),

  setOpenMenuId: (openMenuId) => set({ openMenuId }),

  setIsLoadingRoom: (isLoadingRoom) => set({ isLoadingRoom }),

  setInitialState: (initialState) => set({ initialState }),

  reset: () => set(initialState),
});
