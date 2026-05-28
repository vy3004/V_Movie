import { describe, expect, it } from "vitest";
import {
  mergeParticipantRealtimeRow,
  removeParticipantRealtimeRow,
} from "@/stores/watch-party/participant-realtime";
import { WatchPartyParticipant } from "@/types";

function participant(
  overrides: Partial<WatchPartyParticipant>,
): WatchPartyParticipant {
  return {
    id: "p-1",
    room_id: "room-1",
    user_id: "guest-1",
    role: "guest",
    status: "approved",
    permissions: { can_control_media: false, can_manage_users: false },
    is_muted: false,
    is_voice_muted: false,
    joined_at: "2026-05-19T00:00:00.000Z",
    created_at: "2026-05-19T00:00:00.000Z",
    display_name: "Guest One",
    avatar_url: null,
    profiles: undefined,
    ...overrides,
  } as WatchPartyParticipant;
}

describe("watch party participant realtime merge", () => {
  it("applies newer participant update", () => {
    const current = participant({ realtime_revision: 1 });
    const incoming = participant({
      realtime_revision: 2,
      permissions: { can_control_media: true, can_manage_users: false },
    });

    const result = mergeParticipantRealtimeRow([current], incoming);

    expect(result[0].permissions.can_control_media).toBe(true);
  });

  it("ignores stale participant update", () => {
    const current = participant({
      realtime_revision: 3,
      permissions: { can_control_media: true, can_manage_users: false },
    });
    const incoming = participant({
      realtime_revision: 2,
      permissions: { can_control_media: false, can_manage_users: false },
    });

    const result = mergeParticipantRealtimeRow([current], incoming);

    expect(result[0].permissions.can_control_media).toBe(true);
  });

  it("adds participant insert when missing", () => {
    const incoming = participant({
      id: "p-2",
      user_id: "guest-2",
      realtime_revision: 1,
    });

    const result = mergeParticipantRealtimeRow([], incoming);

    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe("guest-2");
  });

  it("removes participant by id from delete event", () => {
    const current = participant({
      id: "p-1",
      user_id: "guest-1",
      realtime_revision: 3,
    });

    const result = removeParticipantRealtimeRow([current], {
      id: "p-1",
      user_id: "guest-1",
    });

    expect(result).toEqual([]);
  });
});
