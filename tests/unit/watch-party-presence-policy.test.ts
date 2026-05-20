import { describe, expect, it } from "vitest";
import {
  GUEST_OFFLINE_KICK_MS,
  HOST_OFFLINE_SUCCESSION_MS,
  PRESENCE_HEARTBEAT_INTERVAL_MS,
  PRESENCE_LEASE_REFRESH_INTERVAL_MS,
  isOfflineGuestKickLeader,
  isPresenceCleanupLeader,
  shouldKickGuestAfterOfflineTimer,
  shouldStartGuestOfflineTimer,
} from "@/stores/watch-party/presence-policy";
import type { WatchPartyParticipant } from "@/types";

const approvedGuest = (overrides: Partial<WatchPartyParticipant> = {}) =>
  ({
    id: "participant-1",
    room_id: "room-1",
    user_id: "guest-1",
    role: "guest",
    status: "approved",
    permissions: { can_manage_users: false, can_control_media: false },
    created_at: new Date().toISOString(),
    ...overrides,
  }) as WatchPartyParticipant;

const approvedHost = (overrides: Partial<WatchPartyParticipant> = {}) =>
  approvedGuest({
    id: "host-participant",
    user_id: "host-1",
    role: "host",
    permissions: { can_manage_users: true, can_control_media: true },
    ...overrides,
  });

describe("watch party presence policy", () => {
  it("does not start offline timer during initial connection grace", () => {
    const now = Date.now();

    expect(
      shouldStartGuestOfflineTimer({
        participant: approvedGuest(),
        now,
        explicitOfflineUserIds: new Set(),
        staleLeaseUserIds: new Set(),
        firstSeenParticipantAt: now,
      }),
    ).toBe(false);
  });

  it("starts offline timer when Redis lease expires", () => {
    const now = Date.now();

    expect(
      shouldStartGuestOfflineTimer({
        participant: approvedGuest(),
        now,
        explicitOfflineUserIds: new Set(),
        staleLeaseUserIds: new Set(["guest-1"]),
        firstSeenParticipantAt: now - 60_000,
      }),
    ).toBe(true);
  });

  it("starts offline timer immediately for explicit route leave intent", () => {
    const now = Date.now();

    expect(
      shouldStartGuestOfflineTimer({
        participant: approvedGuest(),
        now,
        explicitOfflineUserIds: new Set(["guest-1"]),
        staleLeaseUserIds: new Set(),
        firstSeenParticipantAt: now,
      }),
    ).toBe(true);
  });

  it("starts offline timer when a previously present guest disappears", () => {
    const now = Date.now();

    expect(
      shouldStartGuestOfflineTimer({
        participant: approvedGuest(),
        now,
        explicitOfflineUserIds: new Set(),
        staleLeaseUserIds: new Set(),
        missingSeenPresenceUserIds: new Set(["guest-1"]),
        firstSeenParticipantAt: now,
      }),
    ).toBe(true);
  });

  it("kicks approved guest after offline timer when presence is still missing", () => {
    expect(
      shouldKickGuestAfterOfflineTimer({
        participant: approvedGuest(),
        hasPresence: false,
      }),
    ).toBe(true);
  });

  it("does not kick guest after offline timer when presence returned", () => {
    expect(
      shouldKickGuestAfterOfflineTimer({
        participant: approvedGuest(),
        hasPresence: true,
      }),
    ).toBe(false);
  });

  it("uses slower presence polling thresholds", () => {
    expect(PRESENCE_HEARTBEAT_INTERVAL_MS).toBe(15_000);
    expect(PRESENCE_LEASE_REFRESH_INTERVAL_MS).toBe(10_000);
    expect(GUEST_OFFLINE_KICK_MS).toBe(30_000);
    expect(HOST_OFFLINE_SUCCESSION_MS).toBe(45_000);
  });

  it("uses online host as cleanup leader", () => {
    expect(
      isPresenceCleanupLeader({
        currentUserId: "host-1",
        participants: [approvedHost(), approvedGuest()],
        presenceData: {
          "host-1": {
            user_id: "host-1",
            status: "online",
            tab_id: "host-tab",
            updated_at: new Date().toISOString(),
          },
          "guest-1": {
            user_id: "guest-1",
            status: "online",
            tab_id: "guest-tab",
            updated_at: new Date().toISOString(),
          },
        },
      }),
    ).toBe(true);
  });

  it("does not let mod cleanup while host is online", () => {
    expect(
      isPresenceCleanupLeader({
        currentUserId: "mod-1",
        participants: [
          approvedHost(),
          approvedGuest({
            user_id: "mod-1",
            permissions: { can_manage_users: true, can_control_media: false },
          }),
        ],
        presenceData: {
          "host-1": {
            user_id: "host-1",
            status: "online",
            tab_id: "host-tab",
            updated_at: new Date().toISOString(),
          },
          "mod-1": {
            user_id: "mod-1",
            status: "online",
            tab_id: "mod-tab",
            updated_at: new Date().toISOString(),
          },
        },
      }),
    ).toBe(false);
  });

  it("falls back to earliest online mod when host is missing", () => {
    expect(
      isPresenceCleanupLeader({
        currentUserId: "mod-1",
        participants: [
          approvedHost(),
          approvedGuest({
            id: "mod-1-participant",
            user_id: "mod-1",
            permissions: { can_manage_users: true, can_control_media: false },
            created_at: "2026-05-20T00:00:00.000Z",
          }),
          approvedGuest({
            id: "mod-2-participant",
            user_id: "mod-2",
            permissions: { can_manage_users: true, can_control_media: false },
            created_at: "2026-05-20T00:01:00.000Z",
          }),
        ],
        presenceData: {
          "mod-1": {
            user_id: "mod-1",
            status: "online",
            tab_id: "mod-1-tab",
            updated_at: new Date().toISOString(),
          },
          "mod-2": {
            user_id: "mod-2",
            status: "online",
            tab_id: "mod-2-tab",
            updated_at: new Date().toISOString(),
          },
        },
      }),
    ).toBe(true);
  });

  it("lets earliest online mod kick offline guests when host is missing", () => {
    expect(
      isOfflineGuestKickLeader({
        currentUserId: "mod-1",
        participants: [
          approvedHost(),
          approvedGuest({
            id: "mod-1-participant",
            user_id: "mod-1",
            permissions: { can_manage_users: true, can_control_media: false },
            created_at: "2026-05-20T00:00:00.000Z",
          }),
          approvedGuest({
            id: "guest-2-participant",
            user_id: "guest-2",
            permissions: { can_manage_users: false, can_control_media: false },
            created_at: "2026-05-20T00:01:00.000Z",
          }),
        ],
        presenceData: {
          "mod-1": {
            user_id: "mod-1",
            status: "online",
            tab_id: "mod-1-tab",
            updated_at: new Date().toISOString(),
          },
          "guest-2": {
            user_id: "guest-2",
            status: "online",
            tab_id: "guest-2-tab",
            updated_at: new Date().toISOString(),
          },
        },
      }),
    ).toBe(true);
  });
});
