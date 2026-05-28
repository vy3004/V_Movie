import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WatchPartyProvider } from "@/providers/WatchPartyProvider";
import { useWatchPartyStore } from "@/stores/watch-party";
import type { ChatMessage, WatchPartyParticipant, WatchPartyRoom } from "@/types";

const mockSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: () => mockSupabase,
}));

vi.mock("@/features/watch-party/playback-sync", () => ({
  usePlaybackRealtime: () => ({
    sendControl: vi.fn(),
    sendHeartbeat: vi.fn(),
    applyInitialState: vi.fn(),
    isLoadingRoom: false,
    initialState: null,
    activeControllerId: undefined,
    activeControllerName: undefined,
  }),
}));

const room = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  room_code: "ABC123",
  host_id: "user-1",
  current_movie_slug: null,
  current_episode_slug: null,
  movie_image: null,
  title: "Room",
  is_private: false,
  participant_count: 1,
  max_participants: 10,
  is_active: true,
  settings: {
    wait_for_all: false,
    guest_can_chat: true,
    allow_guest_control: false,
  },
  created_at: "2026-05-16T00:00:00.000Z",
  updated_at: "2026-05-16T00:00:00.000Z",
} as WatchPartyRoom;

const me = {
  id: "participant-1",
  room_id: room.id,
  user_id: "user-1",
  role: "host",
  status: "approved",
  permissions: {
    can_manage_users: false,
    can_control_media: false,
  },
  is_muted: false,
  is_voice_muted: false,
  created_at: "2026-05-16T00:00:00.000Z",
} as WatchPartyParticipant;

const queryResult = (data: unknown) => {
  const result = { data, error: null };
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
    then: vi.fn((resolve) => Promise.resolve(result).then(resolve)),
  };

  return builder;
};

describe("WatchPartyProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWatchPartyStore.setState({
      room: null,
      user: null,
      myParticipantId: null,
      participants: [],
      playlist: [],
      messages: [],
    });
  });

  it("hydrates existing playlist items after refresh", async () => {
    const playlistItem = {
      id: "playlist-1",
      room_id: room.id,
      movie_slug: "one-piece",
      movie_name: "One Piece",
      episode_slug: "tap-1",
      thumb_url: "thumb.jpg",
      sort_order: 0,
      added_by: "user-1",
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "watch_party_participants") return queryResult([me]);
      if (table === "watch_party_playlist") return queryResult([playlistItem]);
      if (table === "watch_party_messages") return queryResult([]);
      throw new Error(`Unexpected table: ${table}`);
    });

    render(
      React.createElement(
        WatchPartyProvider,
        {
          roomId: room.id,
          user: ({ id: "user-1" } as never),
          initialRoom: room,
          initialMe: me,
          children: React.createElement("div"),
        },
      ),
    );

    await waitFor(() => {
      expect(useWatchPartyStore.getState().playlist).toEqual([playlistItem]);
    });
  });

  it("hydrates existing chat messages after entering room", async () => {
    const message = {
      id: "message-1",
      room_id: room.id,
      user_id: "user-1",
      user_name: "Host",
      avatar_url: "avatar.jpg",
      text: "Xin chào",
      type: "chat",
      created_at: "2026-05-16T00:00:00.000Z",
    } as ChatMessage;

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "watch_party_participants") return queryResult([me]);
      if (table === "watch_party_playlist") return queryResult([]);
      if (table === "watch_party_messages") return queryResult([message]);
      throw new Error(`Unexpected table: ${table}`);
    });

    render(
      React.createElement(
        WatchPartyProvider,
        {
          roomId: room.id,
          user: ({ id: "user-1" } as never),
          initialRoom: room,
          initialMe: me,
          children: React.createElement("div"),
        },
      ),
    );

    await waitFor(() => {
      expect(useWatchPartyStore.getState().messages).toEqual([message]);
    });
  });

  it("merges initial chat snapshot with realtime messages already in store", async () => {
    const snapshotMessage = {
      id: "message-1",
      room_id: room.id,
      user_id: "user-1",
      user_name: "Host",
      avatar_url: "avatar.jpg",
      text: "Tin nhắn cũ",
      type: "chat",
      created_at: "2026-05-16T00:00:00.000Z",
    } as ChatMessage;
    const realtimeMessage = {
      id: "message-2",
      room_id: room.id,
      user_id: "user-2",
      user_name: "Guest",
      avatar_url: "guest.jpg",
      text: "Tin nhắn realtime",
      type: "chat",
      created_at: "2026-05-16T00:00:01.000Z",
    } as ChatMessage;

    useWatchPartyStore.getState().addMessage(realtimeMessage);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "watch_party_participants") return queryResult([me]);
      if (table === "watch_party_playlist") return queryResult([]);
      if (table === "watch_party_messages") return queryResult([snapshotMessage]);
      throw new Error(`Unexpected table: ${table}`);
    });

    render(
      React.createElement(
        WatchPartyProvider,
        {
          roomId: room.id,
          user: ({ id: "user-1" } as never),
          initialRoom: room,
          initialMe: me,
          children: React.createElement("div"),
        },
      ),
    );

    await waitFor(() => {
      expect(useWatchPartyStore.getState().messages).toEqual([
        snapshotMessage,
        realtimeMessage,
      ]);
    });
  });
});
