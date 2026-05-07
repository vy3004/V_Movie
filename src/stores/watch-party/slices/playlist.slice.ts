import { StateCreator } from "zustand";
import { PlaylistSlice } from "./types";

const initialState = {
  playlist: [],
  isLoadingPlaylist: false,
  dragItem: null,
  dragOverItem: null,
};

export const createPlaylistSlice: StateCreator<PlaylistSlice> = (set) => ({
  ...initialState,

  setPlaylist: (playlist) => set({ playlist }),

  addPlaylistItem: (item) =>
    set((state) => ({
      playlist: [...state.playlist, item].sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    })),

  removePlaylistItem: (id) =>
    set((state) => ({
      playlist: state.playlist.filter((item) => item.id !== id),
    })),

  updatePlaylistItem: (id, updates) =>
    set((state) => ({
      playlist: state.playlist
        .map((item) => (item.id === id ? { ...item, ...updates } : item))
        .sort((a, b) => a.sort_order - b.sort_order),
    })),

  reorderPlaylist: (fromIndex, toIndex) =>
    set((state) => {
      const newPlaylist = [...state.playlist];
      const [draggedItem] = newPlaylist.splice(fromIndex, 1);
      newPlaylist.splice(toIndex, 0, draggedItem);
      return { playlist: newPlaylist };
    }),

  setDragItem: (index) => set({ dragItem: index }),

  setDragOverItem: (index) => set({ dragOverItem: index }),

  resetDrag: () => set({ dragItem: null, dragOverItem: null }),

  setLoadingPlaylist: (loading) => set({ isLoadingPlaylist: loading }),

  reset: () => set(initialState),
});
