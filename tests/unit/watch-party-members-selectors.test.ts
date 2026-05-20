import { describe, expect, it } from "vitest";
import {
  selectCanAccessRoomSettings,
  selectCanControl,
  selectHasModeratorAuth,
  selectHasPermission,
  selectIsHost,
  selectMyParticipant,
} from "@/stores/watch-party/selectors";
import type { WatchPartyStore } from "@/stores/watch-party/slices/types";
import type { WatchPartyParticipant, WatchPartyRoom } from "@/types";

const participant = (
  overrides: Partial<WatchPartyParticipant>,
): WatchPartyParticipant => ({
  id: "participant-1",
  room_id: "room-1",
  user_id: "user-1",
  role: "guest",
  status: "approved",
  is_muted: false,
  is_voice_muted: false,
  created_at: "2026-05-16T00:00:00.000Z",
  ...overrides,
  permissions: {
    can_manage_users: false,
    can_control_media: false,
    ...overrides.permissions,
  },
});

const room = (overrides: Partial<WatchPartyRoom> = {}): WatchPartyRoom => ({
  id: "room-1",
  room_code: "ABC123",
  host_id: "host-user",
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
  ...overrides,
});

const state = (overrides: Partial<WatchPartyStore>): WatchPartyStore =>
  ({
    room: room(),
    participants: [],
    myParticipantId: "participant-1",
    user: { id: "user-1" } as never,
    ...overrides,
  }) as WatchPartyStore;

describe("watch party member selectors", () => {
  it("uses myParticipantId before user.id when selecting current participant", () => {
    const matchedById = participant({
      id: "participant-1",
      user_id: "other-user",
    });
    const matchedByUserId = participant({
      id: "participant-2",
      user_id: "user-1",
    });

    expect(
      selectMyParticipant(
        state({ participants: [matchedByUserId, matchedById] }),
      ),
    ).toBe(matchedById);
  });

  it("falls back to user.id when myParticipantId is null", () => {
    const me = participant({ id: "participant-2", user_id: "user-1" });

    expect(
      selectMyParticipant(
        state({ myParticipantId: null, participants: [me] }),
      ),
    ).toBe(me);
  });

  it("detects host user when myParticipantId is null", () => {
    const host = participant({
      id: "participant-2",
      user_id: "host-user",
      role: "host",
      status: "approved",
    });

    expect(
      selectIsHost(
        state({
          myParticipantId: null,
          participants: [host],
          user: { id: "host-user" } as never,
        }),
      ),
    ).toBe(true);
  });

  it("allows host control when myParticipantId is null", () => {
    const host = participant({
      id: "participant-2",
      user_id: "host-user",
      role: "host",
      status: "approved",
    });

    expect(
      selectCanControl(
        state({
          myParticipantId: null,
          participants: [host],
          user: { id: "host-user" } as never,
        }),
      ),
    ).toBe(true);
  });

  it("allows approved guest with media control when myParticipantId is null", () => {
    const controller = participant({
      id: "participant-2",
      user_id: "user-1",
      role: "guest",
      status: "approved",
      permissions: { can_manage_users: false, can_control_media: true },
    });

    expect(
      selectCanControl(
        state({ myParticipantId: null, participants: [controller] }),
      ),
    ).toBe(true);
  });

  it("grants moderator auth to approved host", () => {
    const host = participant({ role: "host", status: "approved" });

    expect(selectHasModeratorAuth(state({ participants: [host] }))).toBe(true);
  });

  it("grants moderator auth to approved guest with can_manage_users", () => {
    const manager = participant({
      role: "guest",
      status: "approved",
      permissions: { can_manage_users: true, can_control_media: false },
    });

    expect(selectHasModeratorAuth(state({ participants: [manager] }))).toBe(
      true,
    );
  });

  it("only allows approved hosts to access room settings", () => {
    const host = participant({ role: "host", status: "approved" });
    const manager = participant({
      role: "guest",
      status: "approved",
      permissions: { can_manage_users: true, can_control_media: false },
    });

    expect(selectCanAccessRoomSettings(state({ participants: [host] }))).toBe(
      true,
    );
    expect(selectCanAccessRoomSettings(state({ participants: [manager] }))).toBe(
      false,
    );
  });

  it("denies moderator auth to pending host and pending guest manager", () => {
    const pendingHost = participant({ role: "host", status: "pending" });
    const pendingManager = participant({
      role: "guest",
      status: "pending",
      permissions: { can_manage_users: true, can_control_media: false },
    });

    expect(selectHasModeratorAuth(state({ participants: [pendingHost] }))).toBe(
      false,
    );
    expect(
      selectHasModeratorAuth(state({ participants: [pendingManager] })),
    ).toBe(false);
  });

  it("requires approved status before granting specific permissions", () => {
    const pendingHost = participant({ role: "host", status: "pending" });
    const approvedHost = participant({ role: "host", status: "approved" });
    const pendingManager = participant({
      role: "guest",
      status: "pending",
      permissions: { can_manage_users: true, can_control_media: false },
    });
    const approvedManager = participant({
      role: "guest",
      status: "approved",
      permissions: { can_manage_users: true, can_control_media: false },
    });

    expect(
      selectHasPermission("can_manage_users")(
        state({ participants: [pendingHost] }),
      ),
    ).toBe(false);
    expect(
      selectHasPermission("can_manage_users")(
        state({ participants: [approvedHost] }),
      ),
    ).toBe(true);
    expect(
      selectHasPermission("can_manage_users")(
        state({ participants: [pendingManager] }),
      ),
    ).toBe(false);
    expect(
      selectHasPermission("can_manage_users")(
        state({ participants: [approvedManager] }),
      ),
    ).toBe(true);
  });
});
