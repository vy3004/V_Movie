import { StateCreator } from "zustand";
import { ChatSlice } from "./types";

const MAX_MESSAGES = 60;

const initialState = {
  messages: [],
  isLoadingMessages: false,
  unreadCount: 0,
  lastReadMessageId: null,
};

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
  ...initialState,

  setMessages: (messages) =>
    set({
      messages: messages.slice(-MAX_MESSAGES),
      isLoadingMessages: false,
    }),

  addMessage: (message) =>
    set((state) => {
      const existingIndex = state.messages.findIndex(
        (m) => m.id === message.id,
      );

      if (existingIndex >= 0) {
        // Message already exists - merge/update it (removes "Đang gửi..." status)
        const newMessages = [...state.messages];
        newMessages[existingIndex] = {
          ...newMessages[existingIndex],
          ...message,
        };
        return { messages: newMessages };
      }

      // New message - add to end
      const newMessages = [...state.messages, message];
      return {
        messages: newMessages.slice(-MAX_MESSAGES),
      };
    }),

  addMessages: (messages) =>
    set((state) => {
      const existingIds = new Set(state.messages.map((m) => m.id));
      const newMessages = messages.filter((m) => !existingIds.has(m.id));

      if (newMessages.length === 0) return state;

      return {
        messages: [...state.messages, ...newMessages].slice(-MAX_MESSAGES),
      };
    }),

  clearMessages: () => set({ messages: [] }),

  setUnreadCount: (unreadCount) => set({ unreadCount }),

  incrementUnread: () =>
    set((state) => ({
      unreadCount: state.unreadCount + 1,
    })),

  resetUnread: () => set({ unreadCount: 0 }),

  setLastReadMessageId: (lastReadMessageId) => set({ lastReadMessageId }),

  removeMessageById: (messageId) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    })),

  reset: () => set(initialState),
});
