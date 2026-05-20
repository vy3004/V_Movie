import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WatchPartyProvider } from "@/providers/WatchPartyProvider";
import { useWatchPartyStore } from "@/stores/watch-party";
import type { WatchPartyParticipant, WatchPartyRoom } from "@/types";

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

const queryResult = (data: unknown) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockResolvedValue({ data, error: null }),
});

describe("WatchPartyProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWatchPartyStore.setState({
      room: null,
      user: null,
      myParticipantId: null,
      participants: [],
      playlist: [],
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
      <WatchPartyProvider
        roomId={room.id}
        user={{ id: "user-1" }}
        initialRoom={room}
        initialMe={me}
      >
        <div />
      </WatchPartyProvider>,
    );

    await waitFor(() => {
      expect(useWatchPartyStore.getState().playlist).toEqual([playlistItem]);
    });
  });

  it("clears room scoped state when room changes", async () => {
    const nextRoom = { ...room, id: "660e8400-e29b-41d4-a716-446655440000" };
    const nextMe = { ...me, id: "participant-2", room_id: nextRoom.id };

    useWatchPartyStore.setState({
      participants: [me],
      playlist: [{ id: "stale", room_id: room.id } as never],
      messages: [{ id: "stale", room_id: room.id } as never],
      presenceData: { [me.id]: { online_at: "2026-05-16T00:00:00.000Z" } },
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "watch_party_participants") return queryResult([nextMe]);
      if (table === "watch_party_playlist") return queryResult([]);
      if (table === "watch_party_messages") return queryResult([]);
      throw new Error(`Unexpected table: ${table}`);
    });

    const { rerender } = render(
      <WatchPartyProvider
        roomId={room.id}
        user={{ id: "user-1" }}
        initialRoom={room}
        initialMe={me}
      >
        <div />
      </WatchPartyProvider>,
    );

    rerender(
      <WatchPartyProvider
        roomId={nextRoom.id}
        user={{ id: "user-1" }}
        initialRoom={nextRoom}
        initialMe={nextMe}
      >
        <div />
      </WatchPartyProvider>,
    );

    expect(useWatchPartyStore.getState().playlist).toEqual([]);
    expect(useWatchPartyStore.getState().messages).toEqual([]);
    expect(useWatchPartyStore.getState().presenceData).toEqual({});

    await waitFor(() => {
      expect(useWatchPartyStore.getState().participants).toEqual([nextMe]);
    });
  });
});
