import { describe, expect, it } from "vitest";
import {
  canApplyHeartbeat,
  canApplyPlaybackState,
  canAcceptRequestedSystemSync,
  canCommitLocalPlaybackIntent,
  canRunFollowerSoftSync,
  getPausedHeartbeatInterval,
  shouldMarkUserIntent,
  shouldSuppressRemoteWhilePendingLocal,
  toPlaybackStatePayload,
} from "@/features/watch-party/playback-sync";

const now = 1_000_000;

describe("playbackRules", () => {
  it("ignores stale version command", () => {
    expect(canApplyPlaybackState({ incomingVersion: 4, lastAppliedVersion: 4 })).toBe(false);
    expect(canApplyPlaybackState({ incomingVersion: 3, lastAppliedVersion: 4 })).toBe(false);
  });

  it("accepts newer command", () => {
    expect(canApplyPlaybackState({ incomingVersion: 5, lastAppliedVersion: 4 })).toBe(true);
  });

  it("suppresses remote rollback while pending local command is alive", () => {
    expect(
      shouldSuppressRemoteWhilePendingLocal({
        pendingRequestId: "user-1-100",
        pendingUntil: now + 1000,
        now,
      }),
    ).toBe(true);
  });

  it("does not suppress remote when pending local command expired", () => {
    expect(
      shouldSuppressRemoteWhilePendingLocal({
        pendingRequestId: "user-1-100",
        pendingUntil: now - 1,
        now,
      }),
    ).toBe(false);
  });

  it("rejects old controller system reply for requested sync", () => {
    expect(
      canAcceptRequestedSystemSync({
        payloadOrigin: "system",
        payloadRequestId: "req-1",
        pendingRequestId: "req-1",
        currentActiveControllerId: "user-new",
        payloadActiveControllerId: "user-old",
      }),
    ).toBe(false);
  });

  it("accepts current controller system reply for requested sync", () => {
    expect(
      canAcceptRequestedSystemSync({
        payloadOrigin: "system",
        payloadRequestId: "req-1",
        pendingRequestId: "req-1",
        currentActiveControllerId: "user-new",
        payloadActiveControllerId: "user-new",
      }),
    ).toBe(true);
  });

  it("rejects stale same-version heartbeat that rewinds canonical player state", () => {
    expect(
      canApplyHeartbeat({
        senderId: "controller-1",
        localUserId: "guest-1",
        heartbeatVersion: 6,
        lastAppliedVersion: 6,
        heartbeatControllerId: "controller-1",
        activeControllerId: "controller-1",
        localControlUntil: 0,
        now,
        currentPlayerState: { time: 60, isPaused: true },
        heartbeatTime: 10,
      }),
    ).toBe(false);
  });

  it("accepts same-version heartbeat that repairs forward drift", () => {
    expect(
      canApplyHeartbeat({
        senderId: "controller-1",
        localUserId: "guest-1",
        heartbeatVersion: 6,
        lastAppliedVersion: 6,
        heartbeatControllerId: "controller-1",
        activeControllerId: "controller-1",
        localControlUntil: 0,
        now,
        currentPlayerState: { time: 10, isPaused: true },
        heartbeatTime: 11,
      }),
    ).toBe(true);
  });

  it("maps canonical state to broadcast payload", () => {
    expect(
      toPlaybackStatePayload(
        {
          status: "pause",
          time: 60,
          episode_slug: "tap-2",
          active_controller_id: "user-1",
          active_controller_name: "Guest",
          version: 7,
          updated_at: now,
        },
        "user-1",
        "seek",
        "req-1",
      ),
    ).toEqual({
      status: "pause",
      action: "seek",
      time: 60,
      episodeSlug: "tap-2",
      activeControllerId: "user-1",
      activeControllerName: "Guest",
      version: 7,
      updatedAt: now,
      senderId: "user-1",
      requestId: "req-1",
      origin: "user",
    });
  });
});

describe("player bridge rules", () => {
  it("requires recent user intent for local seek command", () => {
    expect(
      canCommitLocalPlaybackIntent({
        action: "seek",
        now: 10_000,
        lastUserIntentAt: 7_600,
        suppressLocalSyncUntil: 0,
        remoteLockUntil: 0,
        visibilityState: "visible",
      }),
    ).toBe(true);

    expect(
      canCommitLocalPlaybackIntent({
        action: "seek",
        now: 10_000,
        lastUserIntentAt: 7_499,
        suppressLocalSyncUntil: 0,
        remoteLockUntil: 0,
        visibilityState: "visible",
      }),
    ).toBe(false);
  });

  it("blocks remote events without recent user intent", () => {
    expect(
      canCommitLocalPlaybackIntent({
        action: "play",
        now: 10_000,
        lastUserIntentAt: 0,
        suppressLocalSyncUntil: 11_000,
        remoteLockUntil: 0,
        visibilityState: "visible",
      }),
    ).toBe(false);
  });

  it("allows real user intent to override remote lock", () => {
    expect(
      canCommitLocalPlaybackIntent({
        action: "pause",
        now: 10_000,
        lastUserIntentAt: 9_900,
        suppressLocalSyncUntil: 11_000,
        remoteLockUntil: 11_000,
        visibilityState: "visible",
      }),
    ).toBe(true);
  });

  it("does not run follower soft-sync while recent control intent is active", () => {
    expect(
      canRunFollowerSoftSync({
        hasPlayer: true,
        isHost: false,
        isHostPaused: false,
        canControl: true,
        now: 10_000,
        lastUserIntentAt: 4_001,
      }),
    ).toBe(false);
  });

  it("runs follower soft-sync for non-host without recent control intent", () => {
    expect(
      canRunFollowerSoftSync({
        hasPlayer: true,
        isHost: false,
        isHostPaused: false,
        canControl: true,
        now: 10_000,
        lastUserIntentAt: 3_999,
      }),
    ).toBe(true);
  });

  it("marks user intent only when participant can control", () => {
    expect(shouldMarkUserIntent({ canControl: true })).toBe(true);
    expect(shouldMarkUserIntent({ canControl: false })).toBe(false);
  });

  it("uses short paused heartbeat burst then idle interval", () => {
    expect(getPausedHeartbeatInterval(30_000)).toBe(5_000);
    expect(getPausedHeartbeatInterval(30_001)).toBe(30_000);
  });
});
