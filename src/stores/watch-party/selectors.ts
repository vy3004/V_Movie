import { WatchPartyStore } from "./slices/types";

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
export const selectIsSyncing = (state: WatchPartyStore) => state.isSyncing;

// New simple state selectors
export const selectUser = (state: WatchPartyStore) => state.user;
export const selectKickTarget = (state: WatchPartyStore) => state.kickTarget;
export const selectIsKicked = (state: WatchPartyStore) => state.isKicked;
export const selectOpenMenuId = (state: WatchPartyStore) => state.openMenuId;
export const selectIsLoadingRoom = (state: WatchPartyStore) =>
  state.isLoadingRoom;
export const selectInitialState = (state: WatchPartyStore) =>
  state.initialState;
export const selectPlayerSyncRef = (state: WatchPartyStore) =>
  state.playerSyncRef;

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
  const { room, myParticipantId, participants } = state;
  if (!room || !myParticipantId) return false;

  const me = participants.find((p) => p.id === myParticipantId);
  return me?.role === "host";
};

/**
 * Check if current user can control video
 */
export const selectCanControl = (state: WatchPartyStore) => {
  const { myParticipantId, participants, room } = state;
  if (!myParticipantId || !room) return false;

  const me = participants.find((p) => p.id === myParticipantId);

  // Host always can control
  if (me?.role === "host") return true;

  // Check explicit permission or room setting
  return (
    me?.permissions?.can_control_media ||
    room.settings?.allow_guest_control ||
    false
  );
};

/**
 * Get current user's participant info
 */
export const selectMyParticipant = (state: WatchPartyStore) => {
  const { myParticipantId, participants } = state;
  if (!myParticipantId) return null;

  return participants.find((p) => p.id === myParticipantId) ?? null;
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
  const { myParticipantId, participants } = state;
  if (!myParticipantId) return false;

  const me = participants.find((p) => p.id === myParticipantId);
  if (!me) return false;

  // ONLY host can see settings tab
  return me.role === "host";
};

/**
 * Check if user has specific permission
 */
export const selectHasPermission =
  (permission: "can_control_media" | "can_manage_users") =>
  (state: WatchPartyStore) => {
    const { myParticipantId, participants } = state;
    if (!myParticipantId) return false;

    const me = participants.find((p) => p.id === myParticipantId);
    if (!me) return false;

    // Host always has all permissions
    if (me.role === "host") return true;

    // Check specific permission
    return me.permissions?.[permission] ?? false;
  };
