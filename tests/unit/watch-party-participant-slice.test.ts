import { beforeEach, describe, expect, it } from "vitest";
import { useWatchPartyStore } from "@/stores/watch-party";
import { getParticipantIdentity } from "@/stores/watch-party/selectors";

describe("participant slice", () => {
  beforeEach(() => {
    useWatchPartyStore.setState({
      participants: [],
      myParticipantId: null,
    });
  });

  it("removes participant by participant id", () => {
    useWatchPartyStore.setState({
      participants: [
        { id: "p-1", user_id: "u-1", status: "approved", role: "guest" },
        { id: "p-2", user_id: "u-2", status: "approved", role: "guest" },
      ] as never,
    });

    useWatchPartyStore.getState().removeParticipant("p-1");

    expect(useWatchPartyStore.getState().participants).toEqual([
      { id: "p-2", user_id: "u-2", status: "approved", role: "guest" },
    ]);
  });

  it("removes participant by user id for realtime delete payloads", () => {
    useWatchPartyStore.setState({
      participants: [
        { id: "p-1", user_id: "u-1", status: "approved", role: "guest" },
        { id: "p-2", user_id: "u-2", status: "approved", role: "guest" },
      ] as never,
    });

    useWatchPartyStore.getState().removeParticipantByUserId("u-2");

    expect(useWatchPartyStore.getState().participants).toEqual([
      { id: "p-1", user_id: "u-1", status: "approved", role: "guest" },
    ]);
  });

  it("uses participant identity snapshot before joined profile", () => {
    const identity = getParticipantIdentity({
      id: "p-1",
      room_id: "room-1",
      user_id: "u-1",
      role: "guest",
      status: "approved",
      permissions: { can_manage_users: false, can_control_media: false },
      is_muted: false,
      is_voice_muted: false,
      display_name: "Snapshot Name",
      avatar_url: "snapshot.png",
      created_at: "2026-05-18T00:00:00.000Z",
      profiles: { id: "u-1", full_name: "Profile Name", avatar_url: "profile.png" } as never,
    });

    expect(identity).toEqual({
      fullName: "Snapshot Name",
      avatarUrl: "snapshot.png",
    });
  });

  it("falls back to joined profile when identity snapshot is missing", () => {
    const identity = getParticipantIdentity({
      id: "p-1",
      room_id: "room-1",
      user_id: "u-1",
      role: "guest",
      status: "approved",
      permissions: { can_manage_users: false, can_control_media: false },
      is_muted: false,
      is_voice_muted: false,
      created_at: "2026-05-18T00:00:00.000Z",
      profiles: { id: "u-1", full_name: "Profile Name", avatar_url: "profile.png" } as never,
    });

    expect(identity).toEqual({
      fullName: "Profile Name",
      avatarUrl: "profile.png",
    });
  });
});
