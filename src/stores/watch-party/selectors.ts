import { WatchPartyParticipant } from "@/types/watch-party";
import { WatchPartyStore } from "./slices/types";

export function getParticipantIdentity(participant: WatchPartyParticipant) {
  return {
    fullName:
      participant.display_name ?? participant.profiles?.full_name ?? "",
    avatarUrl:
      participant.avatar_url ?? participant.profiles?.avatar_url ?? "",
  };
}

// ============================================
// BASIC SELECTORS (Direct field access)
// ============================================

export const selectRoom = (state: WatchPartyStore) => state.room;
export const selectParticipants = (state: WatchPartyStore) =>
  state.participants;
export const selectMessages = (state: WatchPartyStore) => state.messages;
export const selectActiveTab = (state: WatchPartyStore) => state.activeTab;
export const selectIsSidebarOpen = (state: WatchPartyStore) =>
  state.isSidebarOpen;
export const selectUnreadCount = (state: WatchPartyStore) => state.unreadCount;

// New simple state selectors
export const selectUser = (state: WatchPartyStore) => state.user;
export const selectKickTarget = (state: WatchPartyStore) => state.kickTarget;
export const selectIsKicked = (state: WatchPartyStore) => state.isKicked;
export const selectOpenMenuId = (state: WatchPartyStore) => state.openMenuId;
export const selectIsLoadingRoom = (state: WatchPartyStore) =>
  state.isLoadingRoom;
export const selectInitialState = (state: WatchPartyStore) =>
  state.initialState;

// Playlist selectors
export const selectPlaylist = (state: WatchPartyStore) => state.playlist;
export const selectIsLoadingPlaylist = (state: WatchPartyStore) =>
  state.isLoadingPlaylist;
export const selectDragItem = (state: WatchPartyStore) => state.dragItem;
export const selectDragOverItem = (state: WatchPartyStore) =>
  state.dragOverItem;

// Presence selectors
export const selectPresenceData = (state: WatchPartyStore) =>
  state.presenceData;
export const selectPresenceByUserId =
  (userId: string) => (state: WatchPartyStore) =>
    state.presenceData[userId] ?? null;

// ============================================
// COMPUTED SELECTORS (With logic)
// ============================================

/**
 * Check if current user is the host
 */
export const selectIsHost = (state: WatchPartyStore) => {
  const me = selectMyParticipant(state);
  return me?.status === "approved" && me.role === "host";
};

/**
 * Check if current user can control video
 */
export const selectCanControl = (state: WatchPartyStore) => {
  const { room } = state;
  if (!room) return false;

  const me = selectMyParticipant(state);
  if (!me || me.status !== "approved") return false;
  if (me.role === "host") return true;

  return (
    me.permissions?.can_control_media === true ||
    room.settings?.allow_guest_control === true
  );
};

/**
 * Get current user's participant info
 */
export const selectMyParticipant = (state: WatchPartyStore) => {
  const { myParticipantId, participants, user } = state;

  return (
    (myParticipantId
      ? participants.find((p) => p.id === myParticipantId)
      : null) ??
    participants.find((p) => p.user_id === user?.id) ??
    null
  );
};

/**
 * Get host participant info
 */
export const selectHostParticipant = (state: WatchPartyStore) => {
  const { room, participants } = state;
  if (!room) return null;

  return participants.find((p) => p.user_id === room.host_id) ?? null;
};

/**
 * Count online participants
 */
export const selectOnlineCount = (state: WatchPartyStore) => {
  return state.participants.length;
};

/**
 * Get participants with control permission
 */
export const selectControllersCount = (state: WatchPartyStore) => {
  return state.participants.filter((p) => p.permissions?.can_control_media)
    .length;
};

/**
 * Check if room is full
 */
export const selectIsRoomFull = (state: WatchPartyStore) => {
  const { room, participants } = state;
  if (!room) return false;

  return participants.length >= room.max_participants;
};

/**
 * Get unread messages (after lastReadMessageId)
 */
export const selectUnreadMessages = (state: WatchPartyStore) => {
  const { messages, lastReadMessageId } = state;
  if (!lastReadMessageId) return [];

  const lastReadIndex = messages.findIndex((m) => m.id === lastReadMessageId);
  return lastReadIndex >= 0 ? messages.slice(lastReadIndex + 1) : [];
};

/**
 * Get latest message
 */
export const selectLatestMessage = (state: WatchPartyStore) => {
  const { messages } = state;
  return messages.length > 0 ? messages[messages.length - 1] : null;
};

// ============================================
// SELECTOR FACTORIES (For dynamic params)
// ============================================

/**
 * Get participant by ID
 */
export const selectParticipantById =
  (id: string) => (state: WatchPartyStore) => {
    return state.participants.find((p) => p.id === id) ?? null;
  };

/**
 * Get participant by user ID
 */
export const selectParticipantByUserId =
  (userId: string) => (state: WatchPartyStore) => {
    return state.participants.find((p) => p.user_id === userId) ?? null;
  };

/**
 * Check if user has moderator authority (can manage users)
 * Settings tab is ONLY visible to host
 */
export const selectHasModeratorAuth = (state: WatchPartyStore) => {
  const me = selectMyParticipant(state);
  if (!me || me.status !== "approved") return false;

  return me.role === "host" || me.permissions?.can_manage_users === true;
};

export const selectCanAccessRoomSettings = (state: WatchPartyStore) => {
  const me = selectMyParticipant(state);
  if (!me || me.status !== "approved") return false;

  return me.role === "host";
};

/**
 * Check if user has specific permission
 */
export const selectHasPermission =
  (permission: "can_control_media" | "can_manage_users") =>
  (state: WatchPartyStore) => {
    const me = selectMyParticipant(state);
    if (!me || me.status !== "approved") return false;

    if (me.role === "host") return true;

    return me.permissions?.[permission] === true;
  };

/**
 * Get participant IDs only (for list rendering without re-render on permission change)
 */
export const selectParticipantIds = (state: WatchPartyStore) =>
  state.participants.map((p) => p.id);

