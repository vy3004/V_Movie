import {
  WatchPartyRoom,
  WatchPartyParticipant,
  ChatMessage,
  UserProfile,
  PlaylistItem,
  UserPresence,
} from "@/types";
import { User } from "@supabase/supabase-js";
import { RealtimeChannel } from "@supabase/supabase-js";

// Base slice interface
export interface BaseSlice {
  reset: () => void;
}

// Room & UI State
export interface RoomSlice extends BaseSlice {
  // Room data
  room: WatchPartyRoom | null;
  isLoading: boolean;
  error: string | null;

  // User info - Accept both UserProfile and Supabase User
  user: UserProfile | User | null;

  // Realtime channels
  dataChannel: RealtimeChannel | null;
  dataChannelStatus: "closed" | "joining" | "joined" | "error" | "timed_out";

  // UI State
  activeTab: "chat" | "playlist" | "members" | "settings";
  isSidebarOpen: boolean;
  isSettingsModalOpen: boolean;

  // Voice state
  wantsVoiceConnected: boolean;
  isVoiceConnected: boolean;

  // Kick state
  kickTarget: WatchPartyParticipant | null;
  isKicked: boolean;

  // Menu state
  openMenuId: string | null;

  // Loading & Initial state
  isLoadingRoom: boolean;
  initialState: { time?: number; isPaused?: boolean } | null;

  // Actions
  setRoom: (room: WatchPartyRoom) => void;
  updateRoom: (updates: Partial<WatchPartyRoom>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setUser: (user: UserProfile | User) => void;
  setDataChannel: (channel: RealtimeChannel | null) => void;
  setDataChannelStatus: (
    status: RoomSlice["dataChannelStatus"],
    channel?: RealtimeChannel | null,
  ) => void;
  setActiveTab: (tab: RoomSlice["activeTab"]) => void;
  toggleSidebar: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  setWantsVoiceConnected: (connected: boolean) => void;
  setIsVoiceConnected: (connected: boolean) => void;
  setKickTarget: (target: WatchPartyParticipant | null) => void;
  setIsKicked: (kicked: boolean) => void;
  setOpenMenuId: (id: string | null) => void;
  setIsLoadingRoom: (loading: boolean) => void;
  setInitialState: (
    state: { time?: number; isPaused?: boolean } | null,
  ) => void;
}

// Participant State
export interface ParticipantSlice extends BaseSlice {
  participants: WatchPartyParticipant[];
  myParticipantId: string | null;

  // Actions
  setParticipants: (participants: WatchPartyParticipant[]) => void;
  addParticipant: (participant: WatchPartyParticipant) => void;
  removeParticipant: (id: string) => void;
  removeParticipantByUserId: (userId: string) => void;
  updateParticipant: (
    id: string,
    updates: Partial<WatchPartyParticipant>,
  ) => void;
  setMyParticipantId: (id: string) => void;
}

// Chat State
export interface ChatSlice extends BaseSlice {
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  unreadCount: number;
  lastReadMessageId: string | null;

  // Actions
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  addMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  resetUnread: () => void;
  setLastReadMessageId: (id: string) => void;
  removeMessageById: (messageId: string) => void;
}

// Playlist State
export interface PlaylistSlice extends BaseSlice {
  playlist: PlaylistItem[];
  isLoadingPlaylist: boolean;
  dragItem: number | null;
  dragOverItem: number | null;

  // Actions
  setPlaylist: (playlist: PlaylistItem[]) => void;
  addPlaylistItem: (item: PlaylistItem) => void;
  removePlaylistItem: (id: string) => void;
  updatePlaylistItem: (id: string, updates: Partial<PlaylistItem>) => void;
  reorderPlaylist: (fromIndex: number, toIndex: number) => void;
  setDragItem: (index: number | null) => void;
  setDragOverItem: (index: number | null) => void;
  resetDrag: () => void;
  setLoadingPlaylist: (loading: boolean) => void;
}

// Presence State
export interface PresenceSlice extends BaseSlice {
  presenceData: Record<string, UserPresence>;

  // Actions
  setPresence: (userId: string, presence: UserPresence) => void;
  removePresence: (userId: string) => void;
  setAllPresence: (presenceData: Record<string, UserPresence>) => void;
}

// Combined Store Type (UI state only - no player sync)
export type WatchPartyStore = RoomSlice &
  ParticipantSlice &
  ChatSlice &
  PlaylistSlice &
  PresenceSlice;
