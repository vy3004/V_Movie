import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  WatchPartyRoom,
  WatchPartyParticipant,
  ChatMessage,
  PlaylistItem,
} from "@/types";

// Mock Supabase
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: vi.fn(() => ({
    from: vi.fn(),
    channel: vi.fn(),
  })),
}));

// Import store and selectors after mocks
import { useWatchPartyStore } from "@/stores/watch-party";
import * as selectors from "@/stores/watch-party/selectors";

// Mock data
const mockRoom: WatchPartyRoom = {
  id: "test-room-id",
  room_code: "ABC123",
  title: "Test Room",
  host_id: "host-user-id",
  current_movie_slug: "test-movie",
  current_episode_slug: "tap-1",
  movie_image: "https://example.com/image.jpg",
  max_participants: 10,
  is_active: true,
  is_public: true,
  created_at: "2026-05-03T00:00:00Z",
  settings: {
    allow_guest_control: false,
    guest_can_chat: true,
  },
};

const mockParticipant: WatchPartyParticipant = {
  id: "participant-id",
  room_id: "test-room-id",
  user_id: "user-id",
  role: "guest",
  status: "approved",
  is_muted: false,
  is_voice_muted: false,
  joined_at: "2026-05-03T00:00:00Z",
  permissions: {
    can_control_media: false,
    can_manage_users: false,
  },
  profiles: {
    full_name: "Test User",
    avatar_url: "https://example.com/avatar.jpg",
  },
};

const mockHostParticipant: WatchPartyParticipant = {
  ...mockParticipant,
  id: "host-participant-id",
  user_id: "host-user-id",
  role: "host",
  permissions: {
    can_control_media: true,
    can_manage_users: true,
  },
};

const mockMessage: ChatMessage = {
  id: "message-id",
  room_id: "test-room-id",
  user_id: "user-id",
  user_name: "Test User",
  avatar_url: "https://example.com/avatar.jpg",
  text: "Hello world",
  type: "chat",
  created_at: "2026-05-03T00:00:00Z",
};

const mockPlaylistItem: PlaylistItem = {
  id: "playlist-item-id",
  room_id: "test-room-id",
  movie_slug: "test-movie-2",
  movie_name: "Test Movie 2",
  episode_slug: "tap-1",
  thumb_url: "https://example.com/thumb.jpg",
  sort_order: 0,
  added_by: "user-id",
  created_at: "2026-05-03T00:00:00Z",
};

describe("Watch Party Store", () => {
  beforeEach(() => {
    // Reset store before each test by calling reset on each slice
    useWatchPartyStore.getState().reset();
  });

  describe("Room State", () => {
    it("should set room", () => {
      useWatchPartyStore.getState().setRoom(mockRoom);

      expect(useWatchPartyStore.getState().room).toEqual(mockRoom);
    });

    it("should update room", () => {
      useWatchPartyStore.getState().setRoom(mockRoom);
      useWatchPartyStore.getState().updateRoom({ title: "Updated Title" });

      const room = useWatchPartyStore.getState().room;
      expect(room?.title).toBe("Updated Title");
      expect(room?.id).toBe(mockRoom.id);
    });

    it("should set user", () => {
      const mockUser = { id: "user-id", full_name: "Test User" } as any;
      useWatchPartyStore.getState().setUser(mockUser);

      expect(useWatchPartyStore.getState().user).toEqual(mockUser);
    });

    it("should manage kick state", () => {
      useWatchPartyStore.getState().setKickTarget(mockParticipant);
      expect(useWatchPartyStore.getState().kickTarget).toEqual(mockParticipant);

      useWatchPartyStore.getState().setIsKicked(true);
      expect(useWatchPartyStore.getState().isKicked).toBe(true);

      useWatchPartyStore.getState().setKickTarget(null);
      expect(useWatchPartyStore.getState().kickTarget).toBeNull();
    });

    it("should manage menu state", () => {
      useWatchPartyStore.getState().setOpenMenuId("menu-id");
      expect(useWatchPartyStore.getState().openMenuId).toBe("menu-id");

      useWatchPartyStore.getState().setOpenMenuId(null);
      expect(useWatchPartyStore.getState().openMenuId).toBeNull();
    });
  });

  describe("Participant State", () => {
    it("should set participants", () => {
      useWatchPartyStore.getState().setParticipants([mockParticipant]);

      const state = useWatchPartyStore.getState();
      expect(state.participants).toHaveLength(1);
      expect(state.participants[0]).toEqual(mockParticipant);
    });

    it("should add participant", () => {
      useWatchPartyStore.getState().addParticipant(mockParticipant);

      const state = useWatchPartyStore.getState();
      expect(state.participants).toHaveLength(1);
      expect(state.participants[0]).toEqual(mockParticipant);
    });

    it("should remove participant", () => {
      useWatchPartyStore.getState().addParticipant(mockParticipant);
      useWatchPartyStore.getState().removeParticipant(mockParticipant.id);

      expect(useWatchPartyStore.getState().participants).toHaveLength(0);
    });

    it("should update participant", () => {
      useWatchPartyStore.getState().addParticipant(mockParticipant);
      useWatchPartyStore
        .getState()
        .updateParticipant(mockParticipant.id, { is_muted: true });

      expect(useWatchPartyStore.getState().participants[0].is_muted).toBe(true);
    });

    it("should set myParticipantId", () => {
      useWatchPartyStore.getState().setMyParticipantId("my-id");

      expect(useWatchPartyStore.getState().myParticipantId).toBe("my-id");
    });
  });

  describe("Chat State", () => {
    it("should set messages", () => {
      useWatchPartyStore.getState().setMessages([mockMessage]);

      const state = useWatchPartyStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0]).toEqual(mockMessage);
    });

    it("should add message", () => {
      useWatchPartyStore.getState().addMessage(mockMessage);

      const state = useWatchPartyStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0]).toEqual(mockMessage);
    });

    it("should add multiple messages", () => {
      const messages = [mockMessage, { ...mockMessage, id: "message-2" }];
      useWatchPartyStore.getState().addMessages(messages);

      expect(useWatchPartyStore.getState().messages).toHaveLength(2);
    });

    it("should clear messages", () => {
      useWatchPartyStore.getState().addMessage(mockMessage);
      useWatchPartyStore.getState().clearMessages();

      expect(useWatchPartyStore.getState().messages).toHaveLength(0);
    });

    it("should manage unread count", () => {
      useWatchPartyStore.getState().incrementUnread();
      expect(useWatchPartyStore.getState().unreadCount).toBe(1);

      useWatchPartyStore.getState().incrementUnread();
      expect(useWatchPartyStore.getState().unreadCount).toBe(2);

      useWatchPartyStore.getState().resetUnread();
      expect(useWatchPartyStore.getState().unreadCount).toBe(0);
    });
  });

  describe("Playlist State", () => {
    it("should set playlist", () => {
      useWatchPartyStore.getState().setPlaylist([mockPlaylistItem]);

      const state = useWatchPartyStore.getState();
      expect(state.playlist).toHaveLength(1);
      expect(state.playlist[0]).toEqual(mockPlaylistItem);
    });

    it("should add playlist item", () => {
      useWatchPartyStore.getState().addPlaylistItem(mockPlaylistItem);

      const state = useWatchPartyStore.getState();
      expect(state.playlist).toHaveLength(1);
      expect(state.playlist[0]).toEqual(mockPlaylistItem);
    });

    it("should remove playlist item", () => {
      useWatchPartyStore.getState().addPlaylistItem(mockPlaylistItem);
      useWatchPartyStore.getState().removePlaylistItem(mockPlaylistItem.id);

      expect(useWatchPartyStore.getState().playlist).toHaveLength(0);
    });

    it("should update playlist item", () => {
      useWatchPartyStore.getState().addPlaylistItem(mockPlaylistItem);
      useWatchPartyStore.getState().updatePlaylistItem(mockPlaylistItem.id, {
        movie_name: "Updated Movie",
      });

      expect(useWatchPartyStore.getState().playlist[0].movie_name).toBe(
        "Updated Movie",
      );
    });

    it("should reorder playlist", () => {
      const item1 = { ...mockPlaylistItem, id: "item-1", sort_order: 0 };
      const item2 = { ...mockPlaylistItem, id: "item-2", sort_order: 1 };
      const item3 = { ...mockPlaylistItem, id: "item-3", sort_order: 2 };

      useWatchPartyStore.getState().setPlaylist([item1, item2, item3]);
      useWatchPartyStore.getState().reorderPlaylist(0, 2); // Move first item to last

      const state = useWatchPartyStore.getState();
      expect(state.playlist[0].id).toBe("item-2");
      expect(state.playlist[1].id).toBe("item-3");
      expect(state.playlist[2].id).toBe("item-1");
    });

    it("should manage drag state", () => {
      useWatchPartyStore.getState().setDragItem(0);
      expect(useWatchPartyStore.getState().dragItem).toBe(0);

      useWatchPartyStore.getState().setDragOverItem(2);
      expect(useWatchPartyStore.getState().dragOverItem).toBe(2);

      useWatchPartyStore.getState().resetDrag();
      const state = useWatchPartyStore.getState();
      expect(state.dragItem).toBeNull();
      expect(state.dragOverItem).toBeNull();
    });

    it("should auto-sort playlist by sort_order", () => {
      const item1 = { ...mockPlaylistItem, id: "item-1", sort_order: 2 };
      const item2 = { ...mockPlaylistItem, id: "item-2", sort_order: 0 };
      const item3 = { ...mockPlaylistItem, id: "item-3", sort_order: 1 };

      useWatchPartyStore.getState().addPlaylistItem(item1);
      useWatchPartyStore.getState().addPlaylistItem(item2);
      useWatchPartyStore.getState().addPlaylistItem(item3);

      const state = useWatchPartyStore.getState();
      expect(state.playlist[0].id).toBe("item-2"); // sort_order: 0
      expect(state.playlist[1].id).toBe("item-3"); // sort_order: 1
      expect(state.playlist[2].id).toBe("item-1"); // sort_order: 2
    });
  });

  describe("Player State", () => {
    it("should update player state", () => {
      useWatchPartyStore.getState().updatePlayerState(120, false);

      const state = useWatchPartyStore.getState();
      expect(state.currentTime).toBe(120);
      expect(state.isPaused).toBe(false);
    });

    it("should set syncing state", () => {
      useWatchPartyStore.getState().setIsSyncing(true);

      expect(useWatchPartyStore.getState().isSyncing).toBe(true);
    });
  });

  describe("Selectors", () => {
    it("should select isHost correctly", () => {
      useWatchPartyStore.getState().setRoom(mockRoom);
      useWatchPartyStore
        .getState()
        .setParticipants([mockHostParticipant, mockParticipant]);
      useWatchPartyStore.getState().setMyParticipantId(mockHostParticipant.id);

      const isHost = selectors.selectIsHost(useWatchPartyStore.getState());

      expect(isHost).toBe(true);
    });

    it("should select canControl correctly for host", () => {
      useWatchPartyStore.getState().setRoom(mockRoom);
      useWatchPartyStore.getState().setParticipants([mockHostParticipant]);
      useWatchPartyStore.getState().setMyParticipantId(mockHostParticipant.id);

      const canControl = selectors.selectCanControl(
        useWatchPartyStore.getState(),
      );

      expect(canControl).toBe(true);
    });

    it("should select canControl correctly for guest with permission", () => {
      const guestWithControl = {
        ...mockParticipant,
        permissions: {
          ...mockParticipant.permissions,
          can_control_media: true,
        },
      };

      useWatchPartyStore.getState().setRoom(mockRoom);
      useWatchPartyStore.getState().setParticipants([guestWithControl]);
      useWatchPartyStore.getState().setMyParticipantId(guestWithControl.id);

      const canControl = selectors.selectCanControl(
        useWatchPartyStore.getState(),
      );

      expect(canControl).toBe(true);
    });

    it("should select hasModeratorAuth only for host", () => {
      useWatchPartyStore.getState().setRoom(mockRoom);
      useWatchPartyStore
        .getState()
        .setParticipants([mockHostParticipant, mockParticipant]);

      // Test host
      useWatchPartyStore.getState().setMyParticipantId(mockHostParticipant.id);
      expect(
        selectors.selectHasModeratorAuth(useWatchPartyStore.getState()),
      ).toBe(true);

      // Test guest (even with can_manage_users permission)
      const guestWithManage = {
        ...mockParticipant,
        permissions: { ...mockParticipant.permissions, can_manage_users: true },
      };
      useWatchPartyStore
        .getState()
        .setParticipants([mockHostParticipant, guestWithManage]);
      useWatchPartyStore.getState().setMyParticipantId(guestWithManage.id);
      expect(
        selectors.selectHasModeratorAuth(useWatchPartyStore.getState()),
      ).toBe(false);
    });
  });
});
